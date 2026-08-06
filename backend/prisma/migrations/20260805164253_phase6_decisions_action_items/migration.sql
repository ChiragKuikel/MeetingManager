/*
  Warnings:

  - You are about to drop the column `action_items` on the `summaries` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('open', 'done');

-- AlterTable
ALTER TABLE "summaries" DROP COLUMN "action_items";

-- CreateTable
CREATE TABLE "decisions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "video_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_questions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "video_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "open_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "video_id" INTEGER NOT NULL,
    "task" TEXT NOT NULL,
    "assignee" TEXT,
    "owner_id" INTEGER,
    "due_date" TIMESTAMP(3),
    "priority" TEXT,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decisions_video_id_idx" ON "decisions"("video_id");

-- CreateIndex
CREATE INDEX "decisions_organization_id_idx" ON "decisions"("organization_id");

-- CreateIndex
CREATE INDEX "open_questions_video_id_idx" ON "open_questions"("video_id");

-- CreateIndex
CREATE INDEX "open_questions_organization_id_idx" ON "open_questions"("organization_id");

-- CreateIndex
CREATE INDEX "action_items_video_id_idx" ON "action_items"("video_id");

-- CreateIndex
CREATE INDEX "action_items_organization_id_idx" ON "action_items"("organization_id");

-- CreateIndex
CREATE INDEX "action_items_owner_id_idx" ON "action_items"("owner_id");

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_questions" ADD CONSTRAINT "open_questions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_questions" ADD CONSTRAINT "open_questions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
