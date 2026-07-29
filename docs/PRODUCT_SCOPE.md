# Travel App MVP — Product Scope Documentation

## 1. Product Vision

This app is a mobile-first collaborative travel planning platform that helps groups organize trips without the chaos of scattered notes, chats, spreadsheets, and screenshots.

The app focuses on four core travel planning needs:

1. Itinerary planning
2. Budget tracking
3. Expense splitting
4. Group coordination

The goal is not to become a booking app like Klook, Airbnb, Agoda, or Expedia. Instead, the app serves as a shared travel workspace where users can plan, organize, and manage trips together.

---

## 2. Core Problem

Planning a trip with friends is often messy.

People usually use:
- Messenger or group chats for coordination
- Notes apps for itinerary
- Google Sheets for budget
- Screenshots for places
- Google Maps for locations
- Separate apps for expense splitting

This causes confusion:
- nobody knows the final itinerary
- budget is unclear
- people forget who paid
- expenses are hard to split
- travel plans are scattered everywhere

This app solves that by putting the trip plan, budget, map, and shared expenses in one place.

---

## 3. Target Users

### Primary Target User
Friend groups planning local or international trips.

Examples:
- college students planning a Japan/Korea trip
- barkadas planning a Cebu, Siargao, or Baguio trip
- couples or small groups planning a vacation
- budget-conscious Filipino travelers

### Secondary Users Later
- travel agencies
- tour coordinators
- student organizations
- digital nomads
- family travelers

For the MVP, the app will focus only on group travelers and budget-conscious users.

---

## 4. Product Promise

Plan trips with friends without the chaos.

The app helps users answer:

- Where are we going?
- What is our itinerary?
- How much is our budget?
- How much have we spent?
- Who paid for what?
- Who owes who?
- What places are included in the trip?

---

## 5. MVP Scope

The MVP will be frontend-first and mobile-first.

For the first version, the app will use mock data only. There will be no backend, no real authentication, no database, and no real API integrations yet.

The goal is to create a clickable and functional frontend prototype that feels like a real app.

---

## 6. MVP Features

### 6.1 Landing Page

Purpose:
Introduce the app and explain its value.

Main content:
- hero section
- app tagline
- short explanation
- call-to-action button
- preview of trip cards or dashboard

Example tagline:
"Plan smarter. Travel together."

---

### 6.2 Dashboard

Purpose:
Show the user's planned trips.

Functionalities:
- display upcoming trips
- show trip cards
- show destination
- show travel dates
- show budget progress
- show group member avatars
- allow user to open a trip

Example trip cards:
- Japan 2027
- Siargao Weekend
- Cebu Food Trip

---

### 6.3 Create Trip Flow

Purpose:
Allow users to create a new trip plan.

Fields:
- trip name
- destination
- start date
- end date
- number of travelers
- total budget
- travel style

Travel style options:
- budget
- relaxed
- adventure
- foodie
- couple
- student

Frontend-first behavior:
- saving can be simulated using React state or localStorage
- no database yet

---

### 6.4 Trip Overview

Purpose:
Show the main summary of a selected trip.

Sections:
- hero map preview
- trip title
- destination
- dates
- budget summary
- itinerary summary
- group members
- quick actions

Quick actions:
- view itinerary
- view budget
- add expense
- invite friends

---

### 6.5 Itinerary Planner

Purpose:
Organize trip activities by day.

Functionalities:
- display itinerary by day
- show activity name
- show time
- show estimated cost
- show location
- allow adding/editing/removing activities in frontend state

Example:
Day 1:
- Arrival at airport
- Check in at hotel
- Dinner near Shibuya

---

### 6.6 Map Preview

Purpose:
Give users a visual sense of where itinerary locations are.

MVP version:
- fake map UI
- map-style card
- location pins
- route line design

No real Google Maps or Mapbox integration yet.

Later version:
- integrate Leaflet + OpenStreetMap
- add real geocoding
- auto-pin itinerary locations

---

### 6.7 Budget Tracker

Purpose:
Help users plan and monitor travel costs.

Budget categories:
- flights
- accommodation
- food
- transport
- activities
- shopping
- emergency

Functionalities:
- show total budget
- show spent amount
- show remaining amount
- show category breakdown
- show progress bars

Frontend-first behavior:
- use mock data first
- later connect to database

---

### 6.8 Expense Splitter

Purpose:
Track shared expenses and calculate who owes who.

Functionalities:
- add an expense
- select who paid
- select amount
- select participants
- calculate each person’s share
- display balances

Example:
Dhan paid ₱4,000 for hotel.
There are 4 travelers.
Each owes ₱1,000.
Other members owe Dhan ₱1,000 each.

---

### 6.9 Invite Friends

Purpose:
Make the app feel collaborative.

MVP version:
- fake invite link
- mock members
- member avatar UI
- invite modal

Later version:
- real invite links
- email invites
- Supabase trip members

---

## 7. Out of Scope for MVP

The MVP will NOT include:

- flight booking
- hotel booking
- Airbnb integration
- Klook integration
- Agoda integration
- real payment processing
- real map API
- real AI generation
- visa legal advice
- public social feed
- travel reels
- chat system
- travel agency dashboard
- mobile app store deployment
- real-time collaboration

These can be considered after the frontend MVP is complete.

---

## 8. Future Features

### Phase 2
- Supabase authentication
- real database
- trip saving
- real collaborators
- real invite links
- localStorage migration to database

### Phase 3
- AI itinerary generator
- AI budget estimator
- trip templates
- packing checklist
- voting on places

### Phase 4
- real map integration using Leaflet/OpenStreetMap
- location search
- auto-generated map pins
- route visualization

### Phase 5
- agency dashboard
- client itinerary builder
- PDF itinerary export
- payment milestone tracking

---

## 9. Frontend-First Build Strategy

The frontend will be built first using mock data.

This allows the product flow, UI, and user experience to be tested before adding backend complexity.

Frontend-first goals:
- make the app clickable
- test the mobile-first experience
- validate the core product scope
- avoid overbuilding backend features too early

---

## 10. Recommended Tech Stack

Frontend:
- React
- Vite
- CSS or Tailwind
- Framer Motion
- Lucide React

Backend later:
- Supabase
- Supabase Auth
- Supabase Realtime
- PostgreSQL

Maps later:
- Leaflet
- OpenStreetMap

Deployment:
- Vercel

---

## 11. MVP Success Criteria

The MVP is successful if a user can:

1. Open the app
2. Understand what the app does
3. View planned trips
4. Create a mock trip
5. Open a trip
6. View itinerary
7. View budget breakdown
8. Add or view expenses
9. Understand who owes who
10. Invite friends through a mock collaboration flow

If these are working, the frontend MVP is complete.
