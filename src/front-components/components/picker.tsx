import { Button } from 'twenty-ui/primitives/input';
import { Dropdown } from 'twenty-ui/components/navigation';
import { IconChevronDown } from 'twenty-ui/icon';

export const Picker = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) => (
  <Dropdown.Root type="picker">
    <Dropdown.Trigger
      render={
        <Button
          disabled={disabled}
          aria-label={label}
          endIcon={<IconChevronDown size={16} />}
        >
          {options.find((o) => o.value === value)?.label ?? label}
        </Button>
      }
    />
    <Dropdown.Content aria-label={label}>
      <Dropdown.Section label={label}>
        {options.map((option) => (
          <Dropdown.OptionItem
            key={option.value}
            value={option.value}
            selected={value === option.value}
            onSelect={() => onChange(option.value)}
          >
            {option.label}
          </Dropdown.OptionItem>
        ))}
      </Dropdown.Section>
    </Dropdown.Content>
  </Dropdown.Root>
);
