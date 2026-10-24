import type { ButtonProps } from 'twenty-ui/primitives/input';
import { MainButton, LightButton } from 'twenty-ui/components/input';

export const ImportButton = ({
  emphasis = false,
  className = '',
  ...props
}: ButtonProps & { emphasis?: boolean }) => {
  const Component = emphasis ? MainButton : LightButton;
  return (
    <Component
      size="md"
      variant={emphasis ? 'solid' : 'outline'}
      color={emphasis ? 'accent' : 'neutral'}
      {...props}
      className={`ri-button ${emphasis ? 'ri-button-primary' : ''} ${className}`}
    />
  );
};
