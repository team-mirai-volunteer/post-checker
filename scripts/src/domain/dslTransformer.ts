// DSL内のdataset_idをプレースホルダーに変換するトランスフォーマー
import { parse } from "yaml";

export interface DatasetMapping {
  id: string;
  name: string;
}

/**
 * DSL内のdataset_idsをプレースホルダーに置換する
 * 62e28aa6-2b35-4cb9-9516-4ee934084c84 → "{{dataset:party_info}}"
 * YAMLで{{}}がマッピング構文と誤解されないようクォートで囲む
 */
export function replaceDatasetIdsWithPlaceholders(
  dslContent: string,
  datasets: DatasetMapping[],
): string {
  const idToName = new Map(datasets.map((d) => [d.id, d.name]));

  // UUIDパターン（dataset_idsの値として出現するもの）
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

  return dslContent.replace(uuidPattern, (match) => {
    const name = idToName.get(match.toLowerCase());
    if (name) {
      return `"{{dataset:${name}}}"`;
    }
    return match;
  });
}

/**
 * DSL内のプレースホルダーを実際のdataset_idに置換する
 * "{{dataset:party_info}}" → 62e28aa6-2b35-4cb9-9516-4ee934084c84
 */
export function replacePlaceholdersWithDatasetIds(
  dslContent: string,
  datasets: DatasetMapping[],
): string {
  const nameToId = new Map(datasets.map((d) => [d.name, d.id]));

  // クォート付きプレースホルダーに対応
  const placeholderPattern = /"?\{\{dataset:([^}]+)\}\}"?/g;

  return dslContent.replace(placeholderPattern, (_match, name: string) => {
    const id = nameToId.get(name);
    if (id) {
      return id;
    }
    throw new Error(`Dataset not found: ${name}`);
  });
}

/**
 * DSL内のプレースホルダーを抽出する
 */
export function extractPlaceholders(dslContent: string): string[] {
  // クォート付きプレースホルダーに対応
  const placeholderPattern = /"?\{\{dataset:([^}]+)\}\}"?/g;
  const names: string[] = [];

  for (const match of dslContent.matchAll(placeholderPattern)) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }

  return names;
}

/**
 * DSL内のdataset_idsを抽出する（UUID形式）
 */
export function extractDatasetIds(dslContent: string): string[] {
  // YAMLをパースしてdataset_idsを探す
  const parsed = parse(dslContent);
  const ids: string[] = [];

  function findDatasetIds(obj: unknown): void {
    if (obj === null || obj === undefined) return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        findDatasetIds(item);
      }
    } else if (typeof obj === "object") {
      const record = obj as Record<string, unknown>;
      if ("dataset_ids" in record && Array.isArray(record.dataset_ids)) {
        for (const id of record.dataset_ids) {
          if (typeof id === "string" && !ids.includes(id)) {
            ids.push(id);
          }
        }
      }
      for (const value of Object.values(record)) {
        findDatasetIds(value);
      }
    }
  }

  findDatasetIds(parsed);
  return ids;
}
