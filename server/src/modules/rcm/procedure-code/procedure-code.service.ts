import { ProcedureCode, IProcedureCode } from './procedure-code.model';

export class ProcedureCodeService {
  async create(data: Partial<IProcedureCode>): Promise<IProcedureCode> {
    return await ProcedureCode.create(data);
  }

  async list(criteria: any): Promise<{ data: IProcedureCode[]; total: number }> {
    const filter = { ...criteria.filter, isDeleted: false };
    const [data, total] = await Promise.all([
      ProcedureCode.list({ ...criteria, filter }),
      ProcedureCode.totalCount({ filter }),
    ]);
    return { data, total };
  }

  async getById(id: string): Promise<IProcedureCode | null> {
    return await ProcedureCode.findOne({ _id: id, isDeleted: false });
  }

  async getByCode(code: string): Promise<IProcedureCode | null> {
    return await ProcedureCode.findOne({ code, isDeleted: false });
  }

  async update(id: string, data: Partial<IProcedureCode>): Promise<IProcedureCode | null> {
    return await ProcedureCode.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await ProcedureCode.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    return !!result;
  }
}

export const procedureCodeService = new ProcedureCodeService();
