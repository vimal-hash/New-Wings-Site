/** What a page holding the flight shares with it. The rope pages behave exactly as before without one. */
export type RopeLink={
  /** Actual covered starting pose, before any new gesture is followed. */
  startZ:number;
  /** The picture is fully hidden by something in front: no frames are drawn. */
  covered:boolean;
  /** Hidden calibration may pause while another canvas is animating. */
  shouldWarm?:()=>boolean;
  /** Asks for a frame. Set by the rope page once its canvas exists. */
  wake:(()=>void)|null;
  /** The scrolling layer, once it exists. */
  attach(element:HTMLDivElement):void;
  /** Where the camera is, once a frame, in the same frame as the picture. */
  camera(z:number):void;
  /** The scroll share the camera follows, for this share of the real scroll. */
  flightShare(share:number):number;
  /** The flight can be flown. */
  ready():void;
  /** A load or GPU preparation error should release the section scroll. */
  failed():void;
  /** The page's unbroken legs: seconds to hold at the section's white first, where that white ends, and the camera's
   * world units flown at a scroll share. */
  glide:{lead:number;leadShare:number;units:(share:number)=>number};
};
