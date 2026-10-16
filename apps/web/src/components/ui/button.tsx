import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

type ButtonVariant = 'primary' | 'dark' | 'quiet' | 'danger-quiet';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'button-primary',
  dark: 'button-dark',
  quiet: 'button-quiet',
  'danger-quiet': 'button-danger-quiet',
};

export function Button({ variant = 'quiet', icon, className = '', children, ref, ...props }: ButtonProps) {
  return <button ref={ref} className={`button ${variantClasses[variant]} ${className}`.trim()} {...props}>
    {icon}{children}
  </button>;
}
