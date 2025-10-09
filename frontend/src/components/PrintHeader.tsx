import React from 'react';
import printConfig from '@/lib/printConfig';

const PrintHeader: React.FC = () => {
  return (
    <div className="print-header" aria-hidden>
      <img
        src="/uploads/top-logo.png"
        alt="Top Logo"
        className="print-logo-top"
        style={{ width: `${printConfig.topLogoPx}px`, height: 'auto' }}
      />
    </div>
  );
};

export default PrintHeader;
