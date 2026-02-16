
const standards = [14400, 18000, 21600, 25200, 28800, 36000];

function checkBPH(bphObserved) {
    const targetBPH = standards.reduce((prev, curr) =>
        Math.abs(curr - bphObserved) < Math.abs(prev - bphObserved) ? curr : prev
    );

    console.log(`Observed: ${bphObserved}, Target: ${targetBPH}, Diff: ${Math.abs(bphObserved - targetBPH)}`);

    if (Math.abs(bphObserved - targetBPH) < 2000) {
        console.log("LOCKED");
    } else {
        console.log("NOT LOCKED");
    }
}

checkBPH(32000);
checkBPH(28800);
checkBPH(31000); // 2200 away from 28800, 5000 away from 36000. Pick 28800. Diff > 2000. Not Locked.
checkBPH(33000); // 4200 away from 28800, 3000 away from 36000. Pick 36000. Diff 3000. Not Locked.

// What if standards is missing 28800? 
// No, it's in the code I read.
