import { Button } from 'twenty-ui/primitives/input';
import { Dropdown } from 'twenty-ui/components/navigation';
import { IconChevronDown } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';

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
}) => {
  const theme = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[1],
      }}
    >
      <span
        style={{
          color: theme.font.color.secondary,
          fontSize: theme.font.size.sm,
        }}
      >
        {label}
      </span>
      <Dropdown.Root type="picker">
        <Dropdown.Trigger
          render={
            <Button
              disabled={disabled}
              variant="outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                minHeight: 36,
                padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                background: theme.background.primary,
                color: theme.font.color.primary,
                border: `1px solid ${theme.border.color.medium}`,
                borderRadius: theme.border.radius.sm,
              }}
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
    </div>
  );
};
