# Coffee Buddy pose art

Drop dedicated pose sprites here as transparent PNGs, e.g.:

- coffee_idle.png
- coffee_wave.png
- coffee_reading.png
- coffee_sleeping.png
- coffee_typing.png
- coffee_cheering.png
- coffee_drinking.png

Then in `src/data/buddyPoses.ts`, point each pose at its file
(`source: require('../../assets/buddies/coffee_wave.png')`) instead of the
placeholder expression mapping. Nothing else in the app needs to change.
