const CeilingFinder = (nums, target) => {


    let s = 0;
    let e = nums.length - 1;
    while (s <= e) {

        let mid = Math.floor(s + (e - s) / 2);

        if (target > nums[mid]) {
            s = mid + 1
        } else if (target < nums[mid]) {
            e = mid - 1
        } else {
            return nums[mid];
        }


    }
    return s < nums.length ? nums[s] : -1;
}

console.log(CeilingFinder([2, 3, 4, 5, 6, 6, 7, 8, 9, 11, 14, 16], 15))
console.log(CeilingFinder([2, 3, 5, 6, 6, 7, 8, 9, 11, 14, 16], 4))
console.log(CeilingFinder([2, 3, 4, 5, 6, 6, 7, 8, 9, 11, 14, 16], 1))
console.log(CeilingFinder([2, 3, 4, 5, 6, 6, 7, 8, 9, 11, 14, 16], 16))
// console.log(CeilingFinder([2,3,4,5,6,6,7,8,9,11,14,16],15))