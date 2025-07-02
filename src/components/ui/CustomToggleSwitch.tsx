import React from 'react';

interface CustomToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
  className?: string;
  label?: string;
}

export const CustomToggleSwitch: React.FC<CustomToggleSwitchProps> = ({ checked, onChange, id, className = '', label }) => {
  return (
    <label htmlFor={id} className={`inline-flex items-center cursor-pointer select-none ${className}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sr-only"
        aria-checked={checked}
      />
      <div
        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200
          ${checked ? 'bg-green-500' : 'bg-gray-300'}
        `}
      >
        <div
          className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </div>
      {label && (
        <span className={`ml-2 font-bold ${checked ? 'text-green-600' : 'text-red-600'}`}>{label}</span>
      )}
    </label>
  );
}; 