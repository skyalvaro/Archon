import React from 'react';
import { ComboBox, ComboBoxOption } from '../../features/ui/primitives/combobox';

interface TagSuggestionsProps {
  suggestions: string[];
  onSelect: (tag: string) => void;
  placeholder?: string;
  allowCustomValue?: boolean;
  className?: string;
  isLoading?: boolean;
}

export const TagSuggestions: React.FC<TagSuggestionsProps> = ({
  suggestions = [],
  onSelect,
  placeholder = 'Search or create tag...',
  allowCustomValue = true,
  className,
  isLoading = false,
}) => {
  // Convert string suggestions to ComboBox options
  const options: ComboBoxOption[] = suggestions.map((tag) => ({
    value: tag,
    label: tag,
    description: undefined,
  }));

  const handleValueChange = (value: string) => {
    onSelect(value);
  };

  return (
    <ComboBox
      options={options}
      onValueChange={handleValueChange}
      placeholder={placeholder}
      searchPlaceholder="Type to search tags..."
      emptyMessage="No tags found"
      allowCustomValue={allowCustomValue}
      isLoading={isLoading}
      className={className}
    />
  );
};