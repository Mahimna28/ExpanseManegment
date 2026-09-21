declare module 'lucide-react-native' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';

  export interface IconProps extends SvgProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
  }

  export type Icon = React.FC<IconProps>;

  export const Receipt: Icon;
  export const Lock: Icon;
  export const Mail: Icon;
  export const User: Icon;
  export const UserX: Icon;
  export const KeyRound: Icon;
  export const ArrowLeft: Icon;
  export const Users: Icon;
  export const Plus: Icon;
  export const Settings: Icon;
  export const ChevronRight: Icon;
  export const ArrowRightLeft: Icon;
  export const Tags: Icon;
  export const Tag: Icon;
  export const Share2: Icon;
  export const Check: Icon;
  export const CheckCircle: Icon;
  export const CheckCircle2: Icon;
  export const Calendar: Icon;
  export const Search: Icon;
  export const Trash2: Icon;
  export const AlertCircle: Icon;
  export const AlertTriangle: Icon;
  export const RefreshCw: Icon;
  export const CloudOff: Icon;
  export const WifiOff: Icon;
  export const Fingerprint: Icon;
  export const LogOut: Icon;
  export const Crown: Icon;
  export const Shield: Icon;
  export const Archive: Icon;
  export const ArrowRight: Icon;
  export const FileText: Icon;
  export const Utensils: Icon;
  export const Car: Icon;
  export const Home: Icon;
  export const ShoppingCart: Icon;
  export const Coffee: Icon;
  export const Film: Icon;
  export const ShoppingBag: Icon;
  export const Copy: Icon;
  export const ShieldCheck: Icon;
  export const HelpCircle: Icon;

  const icons: Record<string, Icon>;
  export default icons;
}
