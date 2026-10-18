-- Meaning-faithful English translation of the stored caption (option 0), so Content Studio
-- can show it without another LLM call. NULL for English-market rows and rows generated
-- before this change.
ALTER TABLE tbl_localized_promotional_content ADD COLUMN IF NOT EXISTS generated_caption_en TEXT;
