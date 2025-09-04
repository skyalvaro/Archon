import { Plus } from "lucide-react";
import { memo } from "react";
import type { DocumentCreateTriggerProps } from "../types";

export const DocumentCreateTrigger = memo(({ onClick }: DocumentCreateTriggerProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 w-48 h-[120px] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 flex flex-col items-center justify-center cursor-pointer transition-colors group bg-transparent text-inherit font-inherit p-0"
    >
      <Plus className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors mb-2" />
      <span className="text-sm text-gray-500 group-hover:text-blue-500">New Document</span>
    </button>
  );
});

DocumentCreateTrigger.displayName = "DocumentCreateTrigger";
