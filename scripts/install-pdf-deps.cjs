/* Installs the Python dependency the invoice and report PDF renderers need.
 * Runs as npm postinstall so a deploy cannot skip it, and must never fail the
 * JavaScript build: a host without pip simply loses PDF downloads, which the
 * API reports as a 503 with the reason. */
const { spawnSync } = require('node:child_process');

if (process.platform !== 'linux') process.exit(0);

const target = 'vendor/python';
const requirement = 'scripts/requirements-pdf.txt';
const executables = [
  process.env.REPORT_PDF_PYTHON,
  'python3',
  'python',
].filter(Boolean);

for (const executable of executables) {
  const probe = spawnSync(executable, ['-m', 'pip', '--version'], {
    stdio: 'ignore',
  });
  if (probe.status !== 0) continue;
  if (
    spawnSync(
      executable,
      [
        '-m',
        'pip',
        'install',
        '--quiet',
        '--no-cache-dir',
        '--target',
        target,
        '-r',
        requirement,
      ],
      { stdio: 'inherit' },
    ).status === 0
  )
    process.exit(0);
  console.warn(
    'PDF renderer dependency install failed; report and invoice PDFs will return 503.',
  );
  process.exit(0);
}

console.warn(
  'No pip-enabled Python found; report and invoice PDFs will return 503.',
);
