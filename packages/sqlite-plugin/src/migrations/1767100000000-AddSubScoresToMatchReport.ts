import { MigrationInterface, QueryRunner } from "typeorm"
export class AddSubScoresToMatchReport1767100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // SQLite 的 ALTER TABLE ADD COLUMN 在列已存在时会报错，需要逐个 try-catch
    const columns = ["skillScore", "experienceScore", "projectScore", "salaryScore", "developmentScore"]
    for (const col of columns) {
      try {
        await queryRunner.query(`ALTER TABLE "match_report" ADD COLUMN "${col}" integer`)
      } catch {
        // 列已存在，跳过
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = ["skillScore", "experienceScore", "projectScore", "salaryScore", "developmentScore"]
    for (const col of columns) {
      try {
        await queryRunner.query(`ALTER TABLE "match_report" DROP COLUMN "${col}"`)
      } catch {
        // 列不存在，跳过
      }
    }
  }
}
