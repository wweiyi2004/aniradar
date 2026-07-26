-- 事件全文索引:FTS5 外部内容表(content=Event)+ trigram tokenizer,
-- 支持中日文子串匹配;查询词均 >= 3 字符时走 MATCH,更短由应用层回退 LIKE。

CREATE VIRTUAL TABLE "EventFts" USING fts5(
  title,
  titleZh,
  summaryZh,
  content='Event',
  content_rowid='rowid',
  tokenize='trigram'
);

-- 初始回填(external content 模式:值必须与触发器写入口径一致,NULL 统一为 '')
INSERT INTO "EventFts"(rowid, title, titleZh, summaryZh)
SELECT rowid, title, coalesce(titleZh, ''), coalesce(summaryZh, '')
FROM "Event";

CREATE TRIGGER "event_fts_after_insert" AFTER INSERT ON "Event" BEGIN
  INSERT INTO "EventFts"(rowid, title, titleZh, summaryZh)
  VALUES (new.rowid, new.title, coalesce(new.titleZh, ''), coalesce(new.summaryZh, ''));
END;

CREATE TRIGGER "event_fts_after_delete" AFTER DELETE ON "Event" BEGIN
  INSERT INTO "EventFts"("EventFts", rowid, title, titleZh, summaryZh)
  VALUES ('delete', old.rowid, old.title, coalesce(old.titleZh, ''), coalesce(old.summaryZh, ''));
END;

-- 只监听索引列:heatScore 衰减等高频 UPDATE 不应重写 FTS 索引
CREATE TRIGGER "event_fts_after_update" AFTER UPDATE OF title, titleZh, summaryZh ON "Event" BEGIN
  INSERT INTO "EventFts"("EventFts", rowid, title, titleZh, summaryZh)
  VALUES ('delete', old.rowid, old.title, coalesce(old.titleZh, ''), coalesce(old.summaryZh, ''));
  INSERT INTO "EventFts"(rowid, title, titleZh, summaryZh)
  VALUES (new.rowid, new.title, coalesce(new.titleZh, ''), coalesce(new.summaryZh, ''));
END;
