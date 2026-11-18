"use client";
import { forwardRef, useEffect, useMemo } from "react";
import { BoxGeometry, Mesh, type ShaderMaterial } from "three";
import { createLiquidPageMaterial } from "./liquid-page-material";

export type LiquidPearlMesh = Mesh<BoxGeometry, ShaderMaterial>;
/** Resources are owned by this instance, including the low-detail mobile topology. */
const LiquidPearl = forwardRef<LiquidPearlMesh, { mobile?: boolean; pageColour?: string }>(
  function LiquidPearl({ mobile = false, pageColour = "white" }, ref) {
    const geometry = useMemo(() => {
      const segments = mobile ? 24 : 48;
      return new BoxGeometry(2, 2, 2, segments, segments, segments);
    }, [mobile]);
    const material = useMemo(() => createLiquidPageMaterial(), []);
    useEffect(() => {
      material.uniforms.uPage.value.set(pageColour);
    }, [material, pageColour]);
    useEffect(
      () => () => {
        geometry.dispose();
        material.dispose();
      },
      [geometry, material],
    );
    return (
      <mesh
        ref={ref}
        name="Liquid corridor page"
        geometry={geometry}
        material={material}
        frustumCulled={false}
        dispose={null}
      />
    );
  },
);
export default LiquidPearl;
