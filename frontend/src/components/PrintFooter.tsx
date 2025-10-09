import React from 'react';
import printConfig from '@/lib/printConfig';

const PrintFooter: React.FC = () => {
  return (
    <div className="print-footer" aria-hidden>
      <img
        src="/uploads/bottom-logo.png"
        alt="Bottom Logo"
        className="print-logo-bottom"
        style={{ width: `${printConfig.bottomLogoPx}px`, height: 'auto' }}
      />
    </div>
  );
};

export default PrintFooter;
