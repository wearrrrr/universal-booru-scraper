namespace Yandere {
  type TagSummary = {
    num_aliases: number;
    tag: string;
    aliases: string[];
  };

  type TagSearchOpt = {
    limit?: number
    page?: number
    order?: 'date' | 'count' | 'name'
    id?: number
    after_id?: number
    name?: string
    name_pattern?: string
  }

  type Tag = {
    label?: string,
    value?: string,
    id: number
    name: string
    count: number
    type: number
    ambiguous: boolean
    category?: string
  }
}
