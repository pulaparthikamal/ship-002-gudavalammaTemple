/*
===========================================================
SEARCH IN AN INFINITE SORTED ARRAY
===========================================================
Problem:
Given a sorted array with unknown size (treat it as infinite),
find the index of the target element.
Return the index if found, otherwise return -1.
-----------------------------------------------------------
Example
Input:
arr    = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]
target = 14
Output:
13
-----------------------------------------------------------
INTUITION
-----------------------------------------------------------
Normal Binary Search needs:
    start = 0
    end = arr.length - 1
But in an infinite array:
    arr.length = ?
We don't know where the array ends.
So first we need to discover a range that definitely
contains the target.
Start with:
    s = 0
    e = 1
If target is greater than arr[e],
expand the range exponentially:
    [0,1]
    [2,5]
    [6,13]
    [14,29]
    ...
Keep expanding until:
    arr[e] >= target
Now we know the target must lie between:
    s and e
Finally perform Binary Search on that range.
-----------------------------------------------------------
APPROACH
-----------------------------------------------------------
1. Start with a small window:
       s = 0
       e = 1
2. While target > arr[e]:
       Move start forward
       Double the search window size
3. Once target is within the window:
       Apply Binary Search
-----------------------------------------------------------
TIME COMPLEXITY
-----------------------------------------------------------
Range Expansion : O(log n)
Binary Search   : O(log n)
Overall:
    O(log n)
-----------------------------------------------------------
SPACE COMPLEXITY
-----------------------------------------------------------
O(1)
===========================================================
*/

/* A good interview intuition sentence is:

 “Since the array size is unknown, I first find a valid range containing the target by expanding the search window exponentially. Once the target is guaranteed to be inside the range, I apply binary search.”
*/
// const findRange = () => {
//     let s = 0
//     let e = 1;

//     while (target > arr[e]) {
//         let newS = e + 1;
//         e = e + 2 * (e - s + 1)
//         s = newS
//     }
// }



// const infiniteArraysearch = (arr, target) => {
//     console.log("came")

//     let s = 0
//     let e = 1;

//     while (target > arr[e]) {
//         let newS = e + 1;
//         e = e + 2 * (e - s + 1)
//         s = newS
//     }
//     console.log("--------s:", s, "e:", e)

//     // let { s, e } = findRange(arr, target)
//     while (s <= e) {
//         let mid = Math.floor(s + (e - s) / 2)
//         console.log("mid", mid)
//         if (arr[mid] < target) {
//             s = mid + 1
//         } else {
//             e = mid - 1
//         }
//         console.log("s:", s, "e----:", e)
//     }
//     return s

// }




const infiniteArraysearch = (nums, tar) => {

    console.log("hiits")
    let s = 0;
    let e = 0;
    let c = 1;
    let news = -1

    while (tar > nums[e]) {
        news = e;
        c = 2 * c;
        e = e + c
        s = news + 1
    }
    console.log("s,e", s, e)
    while (s < e) {
        let mid = Math.floor(s + (e - s) / 2)
        console.log("mid", mid)
        if (nums[mid] < tar) {
            s = mid + 1
        } else {
            e = mid
        }
        console.log("s:", s, "e----:", e)
    }
    return s

}

console.log("cameeeee", infiniteArraysearch([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 3))






