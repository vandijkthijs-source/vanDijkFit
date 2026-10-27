import { Gesture } from "react-native-gesture-handler";

type Options = {
  enabled: boolean;
  scrollGesture: ReturnType<typeof Gesture.Native>;
  pickUp: (fingerY: number) => boolean;
  move: (fingerY: number) => void;
  drop: () => void;
  cancel: () => void;
};

/** Native recognition owns the entire touch, including the 350 ms hold. */
export function createReorderPan(options: Options) {
  let startY = 0;
  let pickedUp = false;
  return Gesture.Pan()
    .enabled(options.enabled)
    .activateAfterLongPress(350)
    .failOffsetX([-8, 8])
    .failOffsetY([-8, 8])
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .blocksExternalGesture(options.scrollGesture)
    .runOnJS(true)
    .onBegin(event => {
      startY = event.absoluteY;
      pickedUp = false;
    })
    .onStart(event => {
      pickedUp = options.pickUp(startY);
      if (pickedUp) options.move(event.absoluteY);
    })
    .onUpdate(event => {
      if (pickedUp) options.move(event.absoluteY);
    })
    .onEnd((_event, success) => {
      if (!pickedUp) return;
      pickedUp = false;
      if (success) options.drop();
      else options.cancel();
    })
    .onFinalize(() => {
      if (pickedUp) {
        pickedUp = false;
        options.cancel();
      }
    });
}
