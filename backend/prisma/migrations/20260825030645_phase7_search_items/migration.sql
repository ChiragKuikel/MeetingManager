-- CreateEnum
CREATE TYPE "SearchSourceType" AS ENUM ('decision', 'action_item', 'open_question');

-- CreateTable
CREATE TABLE "search_items" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "video_id" INTEGER NOT NULL,
    "source_type" "SearchSourceType" NOT NULL,
    "source_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_items_organization_id_idx" ON "search_items"("organization_id");

-- CreateIndex
CREATE INDEX "search_items_video_id_idx" ON "search_items"("video_id");

-- AddForeignKey
ALTER TABLE "search_items" ADD CONSTRAINT "search_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_items" ADD CONSTRAINT "search_items_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Generated full-text column, kept in sync automatically by Postgres on every insert/update.
ALTER TABLE "search_items" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED;

CREATE INDEX "search_items_search_vector_idx" ON "search_items" USING GIN ("search_vector");

-- ivfflat is fine at this data scale; revisit as HNSW later if the dataset grows (index-only change).
CREATE INDEX "search_items_embedding_idx" ON "search_items" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
