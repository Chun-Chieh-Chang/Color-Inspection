# Color Inspection Tool - User Guide

## Core Concepts

### 1. Calibration Card (Ref / White Balance)

**This is NOT your standard product.**

- **Purpose**: To tell the software "What is White caused by the light source?"
- **What to use**: A **Neutral Grey Card** (best) or a **Plain White Paper**.
- **Why**: Cameras change color based on light (yellowish indoors, bluish outdoors). The software needs a neutral reference to "cancel out" the colored light so it can see the true color of your product.

### 2. Standard Product (Target)

**This IS your golden sample.**

- **Purpose**: To define the "Perfect Color" you want to achieve.
- **What to use**: Your approved sample, Pantone chip, or master part.

### 3. Test Product (Sample)

- **Purpose**: The production part you want to check.
- **What to use**: The actual item from the injection molding machine.

---

## Workflow: Single Image Inspection

**Scenario**: You put a **White Card**, your **Golden Sample**, and your **Test Part** in one photo.

**Steps:**

1.  **Load Image**.
2.  **Draw Box 1 (Ref)**: Draw around the **White Card / Grey Card**.
    - _Do NOT draw on the colored product._
3.  **Draw Box 2 (Standard)**: Draw around your **Golden Sample**.
4.  **Draw Box 3 (Test)**: Draw around your **Production Part**.
5.  **Click INSPECT**.

---

## FAQ

**Q: Why can't I just use my Standard Product as the Ref?**
A: Because if your product is Yellow, the camera sees "Yellow Object + Indoor Light". The software doesn't know how much is "Object Color" and how much is "Light Color".
By using a **White Card (Ref)**, the software sees "White Object + Indoor Light". Since the object _should_ be white, any color it sees is purely "Indoor Light". It subtracts this light color from your product to get the true product color.
