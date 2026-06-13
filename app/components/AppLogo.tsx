import Image from 'next/image';

interface Props {
  height?: number;
}

export default function AppLogo({ height = 36 }: Props) {
  return (
    <Image
      src="/unimatelogo.png"
      alt="uniMate"
      height={height}
      width={Math.round(height * 2.04)}
      priority
      unoptimized
    />
  );
}
