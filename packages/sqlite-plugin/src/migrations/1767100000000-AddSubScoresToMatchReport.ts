import { MigrationInterface, QueryRunner } from "typeorm"
export class AddSubScoresToMatchReport1767100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "match_report" ADD COLUMN "skillScore" integer`)
    await queryRunner.query(`ALTER TABLE "match_report" ADD COLUMN "experienceScore" integer`)
    await queryRunner.query(`ALTER TABLE "match_report" ADD COLUMN "projectScore" integer`)
    await queryRunner.query(`ALTER TABLE "match_report" ADD COLUMN "salaryScore" integer`)
    await queryRunner.query(`ALTER TABLE "match_report" ADD COLUMN "developmentScore" integer`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite 不支持 DROP COLUMN（旧版本），用重建表方式
    await queryRunner.query(`ALTER TABLE "match_report" DROP COLUMN "skillScore"`)
    await queryRunner.query(`ALTER TABLE "match_report" DROP COLUMN "experienceScore"`)
    await queryRunner.query(`ALTER TABLE "match_report" DROP COLUMN "projectScore"`)
    await queryRunner.query(`ALTER TABLE "match_report" DROP COLUMN "salaryScore"`)
    await queryRunner.query(`ALTER TABLE "match_report" DROP COLUMN "developmentScore"`)
  }
}
