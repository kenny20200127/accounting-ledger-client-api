import {
  FindManyOptions,
  FindOptionsWhere,
  ILike,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { CompanyListQueryDto } from './company-list-query.dto';

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function findCompanyList<T extends ObjectLiteral>(
  repository: Repository<T>,
  query: CompanyListQueryDto,
  options: Omit<FindManyOptions<T>, 'where' | 'skip' | 'take'>,
  searchFields: (keyof T & string)[],
  extraWhere?: FindOptionsWhere<T>,
): Promise<T[] | PaginatedList<T>> {
  const term = query.q?.trim();
  // Escape LIKE metacharacters so user input means a literal substring.
  const pattern = term ? `%${term.replace(/[\\%_]/g, '\\$&')}%` : undefined;
  const where = (pattern
    ? searchFields.map((field) => ({
        ...extraWhere,
        companyId: query.companyId,
        [field]: ILike(pattern),
      }))
    : { ...extraWhere, companyId: query.companyId }) as unknown as
    FindOptionsWhere<T> | FindOptionsWhere<T>[];
  const filters = { ...options, where };
  // Preserve the array contract for existing dashboard and lookup consumers.
  if (query.page === undefined && query.limit === undefined)
    return repository.find(filters);
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  const [items, total] = await repository.findAndCount({
    ...filters,
    skip: (page - 1) * limit,
    take: limit,
  });
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
