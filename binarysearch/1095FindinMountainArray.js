Goal
- Define what the new feature is and its primary objective.

Context
- Provide background information, user stories, user personas, or target platforms.

Requirements
- List the functional requirements.
- List any non-functional requirements (performance, accessibility, security).

Input
- Describe any input data, APIs, schemas, user interactions, or design mockups.

Output
- Detail the expected outputs, components, files, or user experiences to be generated.

Acceptance Criteria
- Define clear criteria to determine if the implementation of the feature is complete and correct.let findtargetindexleft = (mountainArr, target, left, right) => {
    let e = right;
    let s = left;
    while (s < e) {
        let mid = Math.floor(s + (e - s) / 2);
        if (mountainArr.get(mid) < target) {
            s = mid + 1;
        } else {
            e = mid;
        }
    }
    if (target === mountainArr.get(s)) {
        return s;
    }
    return -1;
};

let findtargetindexright = (mountainArr, target, left, right) => {
    let e = right;
    let s = left;
    while (s < e) {
        let mid = Math.floor(s + (e - s) / 2);
        if (mountainArr.get(mid) > target) {
            s = mid + 1;
        } else {
            e = mid;
        }
    }
    if (target === mountainArr.get(s)) {
        return s;
    }
    return -1;
};

var findInMountainArray = function (target, mountainArr) {
    let s = 0;
    let length = mountainArr.length();
    let e = length - 1;
    let n = length; // FIX: n should be the total length for the right-side boundary

    // 1. Find the peak element index
    while (s < e) {
        let mid = Math.floor(s + (e - s) / 2);
        if (mountainArr.get(mid) < mountainArr.get(mid + 1)) {
            s = mid + 1;
        } else {
            e = mid;
        }
    }

    // 2. Search in the strictly increasing left side
    let leftindex = findtargetindexleft(mountainArr, target, 0, e);
    if (leftindex !== -1) {
        return leftindex;
    }

    // 3. Search in the strictly decreasing right side
    return findtargetindexright(mountainArr, target, e + 1, n - 1);
};

// ==========================================
// LOCAL TESTING ENVIRONMENT
// ==========================================
class MockMountainArray {
    constructor(arr) {
        this.arr = arr;
    }
    get(index) {
        return this.arr[index];
    }
    length() {
        return this.arr.length;
    }
}

const testArray = new MockMountainArray([1, 2, 3, 4, 5, 3, 1]);
console.log("Target index found at:", findInMountainArray(4, testArray));