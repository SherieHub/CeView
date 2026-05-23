// import React from 'react';
// import { Info } from 'lucide-react';
// import { COLORS } from '../../../constants';

// const ValidationBanner: React.FC<{ isValid: boolean }> = ({ isValid }) => {
//   if (isValid) return null;
  
//   return (
//     <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.TEXT_MAIN }}>
//       <Info size={16} style={{ color: COLORS.GOLD }} />
//       <span className="text-xs font-bold">All five fields must be filled to compute a uniqueness score.</span>
//     </div>
//   );
// };

// export default ValidationBanner;


import React from 'react';
import { Info } from 'lucide-react';
import { COLORS } from '../../../constants';

const ValidationBanner: React.FC<{ isValid: boolean }> = ({ isValid }) => {
  if (isValid) return null;
  
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.TEXT_MAIN }}>
      <Info size={16} style={{ color: COLORS.GOLD }} />
      <span className="text-xs font-bold">All four fields must be filled to compute a uniqueness score.</span>
    </div>
  );
};

export default ValidationBanner;