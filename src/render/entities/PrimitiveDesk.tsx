import type { JSX } from 'react';
import { DESK_Y } from '../tuning';
import { ROLE_COLOUR } from '../../theme';
import type { DeskVisualProps } from '../registry';

export type PrimitiveDeskProps = DeskVisualProps & {
  /** Ghost mode for the hover preview: a translucent tint instead of the role colour. */
  opacity?: number;
  tint?: string;
};

/** A blocky desk primitive: slab, two legs, a monitor plane, tinted by role. */
export function PrimitiveDesk({ x, y, role, opacity = 1, tint }: PrimitiveDeskProps): JSX.Element {
  const colour = tint ?? ROLE_COLOUR[role] ?? ROLE_COLOUR.developer;
  const transparent = opacity < 1;
  return (
    <group position={[x, DESK_Y, y]}>
      <mesh castShadow={!transparent} position={[0, 0.22, 0]}>
        <boxGeometry args={[0.62, 0.06, 0.4]} />
        <meshStandardMaterial color={colour} roughness={0.6} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh castShadow={!transparent} position={[-0.22, 0.1, 0.12]}>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color={colour} roughness={0.6} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh castShadow={!transparent} position={[0.22, 0.1, 0.12]}>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color={colour} roughness={0.6} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh castShadow={!transparent} position={[0, 0.42, -0.08]} rotation-x={-0.15}>
        <boxGeometry args={[0.34, 0.22, 0.03]} />
        <meshStandardMaterial
          color={colour}
          emissive={colour}
          emissiveIntensity={0.6}
          roughness={0.3}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}
