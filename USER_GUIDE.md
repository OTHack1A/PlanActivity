# PlanActivity — User Guide

This guide covers everything you need to get started and use PlanActivity day-to-day.

---

## Table of contents

1. [Starting the application](#1-starting-the-application)
2. [First-time setup](#2-first-time-setup)
3. [The interface at a glance](#3-the-interface-at-a-glance)
4. [Managing departments](#4-managing-departments)
5. [Managing employees](#5-managing-employees)
6. [Recording activities](#6-recording-activities)
7. [Recording absences](#7-recording-absences)
8. [Calendar views](#8-calendar-views)
9. [Exporting data](#9-exporting-data)
10. [Changing your password](#10-changing-your-password)
11. [Uploading a company logo](#11-uploading-a-company-logo)
12. [System log](#12-system-log)
13. [Language selection](#13-language-selection)
14. [Logging out](#14-logging-out)

---

## 1. Starting the application

**Windows (standalone exe)**

Double-click `pianifica.exe`. No console window will open — the server runs
silently in the background.

Open your browser and go to:

```
http://127.0.0.1:16853
```

To stop the application, open **Task Manager**, find `pianifica.exe`, and click
**End Task**.

**Web / server installation**

Your administrator will provide the URL (e.g. `http://192.168.1.10:8000`).
Open it in any modern browser (Chrome, Firefox, Edge, Safari).

---

## 2. First-time setup

On the very first visit the registration screen appears.

1. Enter a **username** (your name or company name — visible in the topbar)
2. Enter your **company name**
3. Choose a **password** (minimum 6 characters)
4. Click **Register**

> This can only be done once. All subsequent logins use the Login screen.

---

## 3. The interface at a glance

```
┌─────────────────────────────────────────────────────┐
│  [Logo]  PlanActivity    IT EN ES  ≡Log  ⚙  Logout  │  ← Topbar
├─────────────────────────────────────────────────────┤
│  ← Jun 2026 →   [Day] [Week] [Month] [Year]         │  ← Navigation
├─────────────────────────────────────────────────────┤
│                                                     │
│          Calendar view area                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

| Control | Function |
|---|---|
| **← →** arrows | Navigate to the previous / next period |
| **Day / Week / Month / Year** | Switch view |
| **≡ Log** | Open the system log (read-only) |
| **⚙** | Open Settings (departments, employees, account) |
| **Logout** | End the session |

---

## 4. Managing departments

Departments group your employees by area (e.g. Mechanics, Body Shop, Admin).

**To add a department:**

1. Click **⚙ Settings** in the topbar
2. Go to the **Departments** tab
3. Click **+ Add department**
4. Enter a name and pick a colour
5. Click **Save**

**To delete a department:**

Click the bin icon next to it. All employees in that department will be moved
to "Unassigned" if any exist.

---

## 5. Managing employees

**To add an employee:**

1. Click **⚙ Settings** → **Employees** tab
2. Click **+ Add employee**
3. Fill in name, role, department, and any overtime hours
4. Click **Save**

**To edit an employee:**

Click the pencil icon next to their name.

**To upload a profile photo:**

Click on the employee's avatar circle. Select a JPG, PNG, or WebP image
(max 2 MB). The photo appears across all views.

**To delete an employee:**

Click the bin icon. All their past activities remain in the database.

---

## 6. Recording activities

Activities represent the work done by an employee on a given day.

**From Day view:**

1. Navigate to the desired date using the **← →** arrows
2. Click on an employee's row — the **Activity modal** opens
3. Click **+ Add activity**
4. Enter a description, hours, and optional notes
5. Add as many activities as needed (their hours should sum to the working day)
6. Click **Save**

**From Week or Month view:**

Click on any coloured cell to jump to that employee's Day view for that date.

> Activities are shown as coloured bars in Week and Month view, coloured by
> the employee's department.

---

## 7. Recording absences

**From Day view:**

1. Navigate to the desired date
2. Click on the absence field for an employee (the coloured dot / label area)
3. Select the absence type:
   - **Vacation** — paid time off
   - **Sick leave** — illness
   - **Leave** — other approved absence
4. To remove an absence, select **None**

Absences appear with distinct labels in all calendar views.

---

## 8. Calendar views

| View | Shows |
|---|---|
| **Day** | All employees, their activities and absences for one day |
| **Week** | 7-day grid with coloured activity bars per employee |
| **Month** | Full month, one row per employee, colour-coded cells |
| **Year** | 12-month overview, presence/absence summary |

Use the **← →** arrows to navigate. Click **Today** (or the date label) to
return to the current date instantly.

---

## 9. Exporting data

### Excel export

1. In **Day view**, click the **Export Excel** button (spreadsheet icon)
2. Choose the export range:
   - **Current day** — one sheet with today's activities
   - **Current week** — one tab per day (Mon–Sun), today highlighted in orange
   - **Current month** — one tab per day, weeks colour-coded
3. The file downloads automatically as `pianifica_<date>.xlsx`

### Mail report

1. In **Day view**, click the **Mail report** button (envelope icon)
2. The report is generated for the current day
3. Click **Copy** to copy to clipboard, or **Download** to save as `.txt`

---

## 10. Changing your password

1. Click **⚙ Settings** → **Account** tab
2. Enter your current password
3. Enter and confirm the new password
4. Click **Save**

> If you forget your password, contact your system administrator to reset the
> application data.

---

## 11. Uploading a company logo

The logo appears on the login screen.

1. On the **login page**, click the logo area
2. Select an image file (JPG, PNG, or WebP, max 2 MB)
3. The logo is saved permanently

> This is a one-time operation — the logo cannot be changed once set.
> If you need to change it, ask your administrator.

---

## 12. System log

The log records every significant action (logins, data changes, errors).

1. Click **≡ Log** in the topbar
2. Browse entries newest-first
3. Use the search field to filter by keyword

The log is read-only from the interface. On disk it is stored as
`pianifica.log` next to the executable and rotates automatically at 10 MB.

---

## 13. Language selection

Click the language buttons in the topbar to switch instantly:

| Button | Language |
|---|---|
| **IT** | Italian |
| **EN** | English |
| **ES** | Spanish |
| **УК** | Ukrainian (Cyrillic) |

Your choice is remembered between sessions.

---

## 14. Logging out

Click **Logout** in the topbar. Your session token is invalidated immediately.
You will be returned to the login screen.

Sessions expire automatically after **8 hours** of inactivity.

---

## Troubleshooting

| Symptom | Solution |
|---|---|
| Browser shows "Unable to connect" | Make sure `pianifica.exe` is running (check Task Manager) |
| Login says "Too many attempts" | Wait 3 minutes, then try again |
| Page appears blank after login | Hard-refresh the browser (Ctrl + Shift + R) |
| Activities not saving | Check that all required fields (description and hours) are filled |
| Logo upload fails | File must be JPG/PNG/WebP and under 2 MB |
| Avatar upload fails | Same as above — JPG/PNG/WebP, max 2 MB |

---

*PlanActivity — lightweight workshop activity planner*
