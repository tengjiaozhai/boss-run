import { MigrationInterface, QueryRunner } from "typeorm"
export class AddMatchReportTable1767000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "match_report" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "encryptJobId" varchar NOT NULL, "encryptCurrentUserId" varchar NOT NULL, "date" datetime NOT NULL, "score" integer, "report" varchar, "jobSource" integer, "autoStartupChatRecordId" integer);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
  }

}
