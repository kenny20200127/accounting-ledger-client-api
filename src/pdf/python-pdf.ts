import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';

/**
 * Deploy targets that cannot install reportlab system-wide put it in
 * vendor/python during the build, so PYTHONPATH is resolved relative to the
 * running application rather than hardcoded to one host's directory layout.
 */
function pythonEnvironment() {
  const vendor = resolve(globalThis.process.cwd(), 'vendor/python');
  const inherited = globalThis.process.env.PYTHONPATH;
  const parts = [existsSync(vendor) ? vendor : '', inherited || ''].filter(
    Boolean,
  );
  if (parts.length === 0) return globalThis.process.env;
  return { ...globalThis.process.env, PYTHONPATH: parts.join(delimiter) };
}

/** Linux images ship python3, Windows installers ship python. */
function pythonExecutable() {
  return (
    globalThis.process.env.REPORT_PDF_PYTHON ||
    (process.platform === 'win32' ? 'python' : 'python3')
  );
}

/**
 * Spawns `script` with the report JSON on stdin and collects the PDF from
 * stdout. Every failure path names its cause: reportlab writes tracebacks to
 * stderr, so surfacing that tail is what distinguishes a missing executable
 * from a missing dependency in the API response.
 */
export function renderPdfViaPython(
  script: string,
  payload: unknown,
  tooLargeMessage: string,
): Promise<Buffer> {
  return new Promise((resolvePdf, reject) => {
    const executable = pythonExecutable();
    const child = spawn(executable, [resolve(process.cwd(), script)], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: pythonEnvironment(),
    });
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    let spawnError: NodeJS.ErrnoException | undefined;
    const detail = () => {
      const stderr = Buffer.concat(errorChunks)
        .toString('utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(-4)
        .join(' ')
        .slice(0, 400);
      return stderr ? ` Python said: ${stderr}` : '';
    };
    const unavailable = (reason: string) =>
      new ServiceUnavailableException(
        `PDF rendering is unavailable. ${reason} Configure REPORT_PDF_PYTHON and install scripts/requirements-pdf.txt.${detail()}`,
      );
    const finish = (error?: Error, buffer?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolvePdf(buffer!);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(unavailable('Rendering timed out after 30 seconds.'));
    }, 30000);
    child.on('error', (error: NodeJS.ErrnoException) => {
      spawnError = error;
      finish(
        unavailable(
          error.code === 'ENOENT'
            ? `Python executable "${executable}" was not found.`
            : `Could not start ${executable}: ${error.message}`,
        ),
      );
    });
    child.stdin.on('error', () => {
      if (!spawnError)
        finish(unavailable(`Could not send the document to ${executable}.`));
    });
    child.stderr.on('data', (chunk: Buffer) => errorChunks.push(chunk));
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 20 * 1024 * 1024) {
        child.kill();
        finish(new ServiceUnavailableException(tooLargeMessage));
        return;
      }
      chunks.push(chunk);
    });
    child.on('close', (code) => {
      const buffer = Buffer.concat(chunks);
      if (spawnError) return;
      if (code !== 0 || !buffer.subarray(0, 5).equals(Buffer.from('%PDF-')))
        finish(
          unavailable(
            `${executable} exited with code ${code ?? 'null'} while rendering the PDF.`,
          ),
        );
      else finish(undefined, buffer);
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
