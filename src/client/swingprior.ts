// The hand-keyed P1-P10 positions (PRD/02 §6), kept as the PRIOR for the motion capture: scripts/motion/retarget-swing.ts fuses
// them with the pose-estimated Dunaway swing (src/client/motion/swingcapture.ts), which is the source of truth the game plays.
// They supply what a single down-the-line camera cannot see (the club shaft and face, the lateral shift toward the target) and
// the P-system ranges the captured turns are held to at each key. Same model space and conventions as golferanim.ts.
import type { Pose, V3 } from './golferanim';

export const P = (p: Partial<Pose>): Pose => ({ ...BASE, ...p });
export const BASE: Pose = {
  pelvis: [0, 0, 0], shift: [0, 0, 0], torso: [0, 0, 0], head: [0, 0, 0], lAnkle: [0, 0, 0], rAnkle: [0, 0, 0], lHeel: 0, rHeel: 0,
  grip: [0.05, 0.8, 0.36], tgrip: [0, 0, 0], gripT: 0, shaft: [0, -0.7, 0.7], face: [1, 0, 0], lPole: [0.3, -0.2, -1], rPole: [-0.3, -0.2, -1],
};
const deg = (d: number) => (d * Math.PI) / 180;
// Turns (y) are about the spine: pelvis = hip turn, pelvis + torso = shoulder turn; negative is away from the target.
const STANCE = { lAnkle: [0.05, 0, 0] as V3, rAnkle: [-0.05, 0, 0] as V3 };
export const TILT = 0.53, SPINE = 0.08;   // ~35° forward from the hips (pelvis) plus a flat upper back; kept P1 to P7 (no standing up)

/** The ten standard swing positions (right-handed), keyed by hand. P1 and P7 aim the shaft at the ball per club (withClub). */
export const P_KEYED: readonly Pose[] = [
  // P1 address: hip hinge, knees flexed, spine 5° away from the target, arms hanging, hands a fist off the thighs, slight shaft lean
  P({ ...STANCE, pelvis: [TILT, 0, 0], shift: [0, -0.06, -0.14],   // ~15-20° knee flex, not a squat
    torso: [SPINE, 0, deg(5)], head: [0.22, 0, 0],
    grip: [0.08, 0.8, 0.22], lPole: [0.35, -0.2, -1], rPole: [-0.35, -0.2, -1] }),   // reachable with straight-ish arms; elbows toward the hips
  // P2 shaft parallel back: shoulders 45°, hips 17°, head outside the hands, toe up, lead arm straight
  P({ ...STANCE, pelvis: [TILT, deg(-17), 0], shift: [-0.02, -0.08, -0.14], torso: [SPINE, deg(-32), deg(5)], head: [0.22, deg(40), 0],
    grip: [-0.3, 0.9, 0.3], shaft: [-1, 0.06, 0.14], face: [0, 0.15, 1], lPole: [0, -1, -0.2], rPole: [0, -1, -0.3] }),
  // P3 lead arm parallel: shoulders 75°, hips 35°, wrists fully hinged (shaft up), trail elbow folding
  P({ ...STANCE, pelvis: [TILT, deg(-35), 0], shift: [-0.03, -0.1, -0.14], torso: [SPINE, deg(-40), deg(5)], head: [0.22, deg(70), 0], lHeel: 0.08,
    // critic round 2: the shaft tilts up and BACK, away from the ball line (~45° from vertical seen down the line), trail elbow down
    grip: [-0.4, 1.05, 0.05], shaft: [-0.25, 0.72, -0.65],
    face: [0, 0.2, 1], lPole: [0, -1, 0], rPole: [0.1, -1, 0.15] }),
  // P4 top: shoulders 90°, hips 45°, lead arm across the chest, hands above the trail shoulder, trail elbow down, shaft along the line.
  // tgrip is in the turned thorax frame: after a 90° turn the chest faces away from the target, so the trail side of the head is OUT of the chest (+z)
  // critic round 2: shoulders 94.5° (inside the owner's 90 ± 5), the lead arm straight and raised across the chest so the hands sit about
  // a head above the head over the trail shoulder: tgrip is the lead shoulder (0.18, 0, 0) plus a straight 0.5 m arm up and across
  P({ ...STANCE, pelvis: [TILT, deg(-45), 0], shift: [-0.04, -0.07, -0.14], torso: [SPINE, deg(-49.5), deg(5)], head: [0.22, deg(90), 0], lHeel: 0.15,
    grip: [-0.25, 1.6, -0.1], tgrip: [-0.2, 0.32, 0.08], gripT: 1, shaft: [1, 0.12, -0.15], face: [0, -0.3, 1], lPole: [0, -1, 0], rPole: [0, -1, 0] }),
  // P5 lead arm parallel down: hands between shoulder and hip, shaft shallowed toward the trail side with ~90° lag, hips 25° open, pelvis 9 cm toward the target, shoulders 45° closed, lag (shaft ~90° to the lead arm)
  P({ ...STANCE, pelvis: [TILT, deg(30), 0], shift: [0.09, -0.1, -0.14], torso: [SPINE, deg(-75), deg(12)], head: [0.22, deg(45), 0],
    grip: [-0.3, 1.02, 0.24], shaft: [-0.3, 0.9, -0.25],   // lead arm level, shaft up and slightly behind: ~90° of lag
    face: [0, 0.2, 1], lPole: [0, -1, 0], rPole: [0, -1, -0.2], rHeel: 0.05 }),
  // P6 shaft parallel down: hips about 38° open (seen from above), shoulders 20° closed, trail knee toward the ball, hands hip high
  P({ ...STANCE, pelvis: [TILT, deg(46), 0], shift: [0.11, -0.1, -0.13], torso: [SPINE, deg(-66), deg(13)], head: [0.22, deg(20), 0],
    grip: [-0.22, 0.9, 0.3], shaft: [-1, 0, -0.05], face: [0, 0.2, 1], lPole: [0, -1, -0.2], rPole: [0, -1, -0.4], rHeel: 0.25, rAnkle: [-0.05, 0.015, 0.02] }),
  // P7 impact: hips 40° open, shoulders 20° open, pelvis over the lead foot, hands 13 cm ahead (shaft lean), trail heel up, head behind the ball
  // critic round 2: the pelvis also moves ~5 cm toward the ball and the trail heel is clearly up (the rig turns that knee in with it)
  P({ ...STANCE, pelvis: [TILT - 0.04, deg(48), 0], shift: [0.14, -0.1, -0.07], torso: [SPINE, deg(-22), deg(15)], head: [0.22, deg(-20), 0], rHeel: 0.6,
    rAnkle: [-0.02, 0.05, 0.04], grip: [0.17, 0.82, 0.27], lPole: [0.35, -0.2, -1], rPole: [-0.35, -0.2, -1] }),
  // P8 shaft parallel through: arms extended, trail arm over, club head up (toe up)
  P({ ...STANCE, pelvis: [0.42, deg(60), 0], shift: [0.1, -0.06, -0.1], torso: [0.1, deg(-10), deg(6)], head: [0.18, deg(-15), 0], rHeel: 0.6,
    rAnkle: [-0.07, 0.03, 0.03], grip: [0.24, 0.9, 0.4], shaft: [1, 0.1, 0.1], face: [0, 0.15, 1], lPole: [0, -1, 0.3], rPole: [0, -1, -0.2] }),
  // P9 trail arm parallel: chest to the target, wrists re-hinging
  P({ ...STANCE, pelvis: [0.25, deg(78), 0], shift: [0.11, -0.04, -0.06], torso: [0.04, deg(14), deg(3)], head: [0.1, deg(-35), 0], rHeel: 0.9,
    rAnkle: [-0.05, 0.06, 0.06], grip: [0.32, 1.32, 0.12], shaft: [0.2, 1, -0.4], face: [0, 0, -1], lPole: [0, -1, 0.2], rPole: [0, -1, 0] }),
  // P10 finish: belt buckle and chest to the target or left of it, weight on the lead foot, trail toe up, club behind the head
  P({ ...STANCE, pelvis: [0.08, deg(92), 0], shift: [0.12, -0.02, 0], torso: [-0.08, deg(12), deg(3)], head: [0, deg(-30), 0], rHeel: 1.2,
    rAnkle: [-0.02, 0.09, 0.09], grip: [0.02, 1.56, -0.2], shaft: [-0.6, -0.2, 0.77], face: [0, 0, -1], lPole: [0, -1, 0], rPole: [0, -1, 0] }),
];
/** Idle and putting poses. */
export const POSES = {
  idle: P({ free: { l: [0.24, 0.86, 0.04], r: [-0.24, 0.86, 0.04] }, shaft: [0, -0.62, 0.78], face: [0, 0, 1], lPole: [0, 0, -1], rPole: [0, 0, -1] }),
  puttAddress: P({ pelvis: [0.42, 0, 0], shift: [0, -0.07, -0.08], torso: [0.3, 0, 0], head: [0.25, 0, 0], lAnkle: [0.02, 0, 0], rAnkle: [-0.02, 0, 0],
    grip: [0.0, 0.8, 0.32], shaft: [0.02, -0.97, 0.25], face: [1, 0, 0], lPole: [0.2, 0, -1], rPole: [-0.2, 0, -1] }),
} satisfies Record<string, Pose>;
