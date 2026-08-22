import * as typeorm from 'typeorm';
const { Entity, PrimaryGeneratedColumn, Column } = typeorm

@Entity()
export class MatchReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  encryptJobId: string;

  @Column()
  encryptCurrentUserId: string;

  @Column()
  date: Date;

  @Column({
    nullable: true
  })
  score?: number;

  @Column({
    nullable: true
  })
  report?: string;

  @Column({
    nullable: true
  })
  jobSource?: number;

  @Column({
    nullable: true
  })
  autoStartupChatRecordId?: number;
}
