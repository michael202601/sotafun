import type { Employee, PrismaClient } from '@prisma/client';
import { withRetry } from '../client';

/** Access to employee records. */
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listEnabled(): Promise<Employee[]> {
    return withRetry(
      () => this.prisma.employee.findMany({ where: { enabled: true } }),
      'employee.listEnabled',
    );
  }

  async findById(id: string): Promise<Employee | null> {
    return withRetry(
      () => this.prisma.employee.findUnique({ where: { id } }),
      'employee.findById',
    );
  }

  async findByChatUserId(googleChatUserId: string): Promise<Employee | null> {
    return withRetry(
      () => this.prisma.employee.findUnique({ where: { googleChatUserId } }),
      'employee.findByChatUserId',
    );
  }

  async findByName(name: string): Promise<Employee | null> {
    return withRetry(
      () => this.prisma.employee.findFirst({ where: { name } }),
      'employee.findByName',
    );
  }
}
