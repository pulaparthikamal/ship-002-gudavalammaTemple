/*
===========================================================
QUESTION: Peak Index in a Mountain Array
===========================================================

A mountain array is an array where:

1. The values strictly increase up to a peak element.
2. After the peak, the values strictly decrease.

Find and return the index of the peak element.

-----------------------------------------------------------
Example

Input:
arr = [24, 69, 100, 99, 79, 78, 67, 36, 26, 19]

Output:
2

Explanation:
100 is the peak element and is located at index 2.

-----------------------------------------------------------
Another Example

Input:
arr = [0, 2, 5, 7, 9, 6, 4, 1]

Output:
4

Explanation:
9 is the peak element and is located at index 4.

-----------------------------------------------------------
Constraints

3 <= arr.length <= 10^5

0 <= arr[i] <= 10^6

arr is guaranteed to be a valid mountain array.

-----------------------------------------------------------
INTUITION

A mountain array has two slopes:

Increasing Slope:
    arr[mid] < arr[mid + 1]

Decreasing Slope:
    arr[mid] > arr[mid + 1]

If we are on the increasing slope,
the peak must be on the right.

If we are on the decreasing slope,
the peak could be mid itself or somewhere on the left.

Use Binary Search to eliminate half of the search
space in every iteration.

-----------------------------------------------------------
APPROACH

1. Initialize:

       s = 0
       e = arr.length - 1

2. While s < e:

       mid = s + (e - s) / 2

3. If arr[mid] < arr[mid + 1]:

       Move Right
       s = mid + 1

4. Else:

       Move Left (keeping mid)
       e = mid

5. When s == e:

       Peak found

-----------------------------------------------------------
TIME COMPLEXITY

O(log n)

Binary Search eliminates half of the remaining
elements in every iteration.

-----------------------------------------------------------
SPACE COMPLEXITY

O(1)

===========================================================
*/
var peakIndexInMountainArray = function (arr) {

    let s = 0;
    let e = arr.length - 1
    while (s <= e) {
        let mid = Math.floor(s + (e - s) / 2)

        if ((arr[mid] > arr[mid + 1]) && (arr[mid] > arr[mid - 1])) {
            return mid

        }
        if (arr[mid] < arr[mid + 1]) {
            s = mid + 1
        } else {
            e = mid - 1
        }

    }

};

console.log(peakIndexInMountainArray([24, 69, 100, 99, 79, 78, 67, 36, 26, 19]
))