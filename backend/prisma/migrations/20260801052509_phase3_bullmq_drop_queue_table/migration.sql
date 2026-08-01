/*
  Warnings:

  - You are about to drop the `processing_queue` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "processing_queue" DROP CONSTRAINT "processing_queue_video_id_fkey";

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "error_message" TEXT;

-- DropTable
DROP TABLE "processing_queue";

-- DropEnum
DROP TYPE "QueueStatus";
