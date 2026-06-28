const searchIndex = (nums, left, right, target) => {

    let s = left;
    let e = right;

    console.log("sss,eee", s, e)
    while (s < e) {
        let mid = Math.floor(s + (e - s) / 2)
        if (nums[mid] < target) {
            s = mid + 1

        } else {

            e = mid
        }

    }
    console.log("sss,eee", s, e)

    if (target === nums[s]) {
        return s
    }

    return -1

}

const duplicaterotatedArrayTargetFinder = (nums, tar) => {

    let s = 0;
    let e = nums.length - 1;
    let n = nums.length - 1;
    let pivot = -1;
    console.log("piv",)


    while (s < e) {

        let mid = Math.floor(s + (e - s) / 2)
        if (nums[mid] > nums[n]) {
            s = mid + 1

        } else {

            pivot = mid - 1
            break;
        }

    }
    console.log("nums[0],nums[pivot],,,tar", nums[0], nums[pivot - 1], tar)

    console.log("nums, 0, pivot, tar", 0, pivot, tar)

    let indefound = searchIndex(nums, 0, pivot, tar)

    console.log("indefoundi", indefound)
    if (indefound !== -1) {
        return indefound
    }
    return searchIndex(nums, pivot + 1, n, tar)

    // if (tar >= nums[0] && tar <= nums[pivot]) {

    //     return searchIndex(nums, 0, pivot, tar)

    // } else {
    //     console.log("target,", tar)

    //     return searchIndex(nums, pivot, n, tar)

    // }
    // return -1

}

console.log(duplicaterotatedArrayTargetFinder([3, 2, 3, 3], 2))

