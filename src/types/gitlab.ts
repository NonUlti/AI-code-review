export interface MergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string;
  web_url: string;
  labels: string[];
  state: string;
  source_branch: string;
  target_branch: string;
  has_conflicts: boolean;
  merge_status?: string;
  detailed_merge_status?: string;
  approvals_before_merge?: number;
  approved?: boolean;
  [key: string]: any;
}

export interface MergeRequestChange {
  old_path: string;
  new_path: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
}
