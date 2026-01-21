// DSL内のdataset_idをプレースホルダーに変換するトランスフォーマー

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

