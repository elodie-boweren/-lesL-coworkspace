# Domain model — CoWork'Space

This document describes how the CoWork'Space business domain is split into
bounded contexts, and defines the ubiquitous language shared by the team,
the client and the code.

> Rule: a term listed in the glossary MUST be used with exactly this name in
> the code (classes, methods, folders, API routes). If a new business concept
> appears, add it here first.

---

## 1. Domain overview

CoWork'Space runs a coworking space: **50 open-space desks**, **4 meeting
rooms**, **~80 members**. Bookings are currently managed in Excel, which
causes **double-bookings**. The core value of the product is:

> **Let members book a space on their own, with a guarantee that the same
> space is never booked twice for overlapping time slots.**

---

## 2. Bounded contexts

| # | Context (code module) | Type | Responsibility | DDD depth |
|---|---|---|---|---|
| 1 | **Booking** (`booking`) | **Core** | Book, reschedule, cancel, recurring bookings, availability, history | Full DDD (aggregates, value objects, policies, events) |
| 2 | **Identity & Access** (`identity`) | Supporting | Registration, email verification, manual approval, login, password reset, profile, roles, account deletion | Light DDD (entity + value objects) |
| 3 | **Space Catalog** (`catalog`) | Supporting | Spaces (desks, meeting rooms), equipment, capacity, floor plan position | CRUD (thin domain) |
| 4 | **Notifications** (`notification`) | Generic | Sends emails in reaction to domain events (confirmation, 24h reminder, cancellation, verification, reset) | Technical, event-driven |
| 5 | **Reporting** (`reporting`) | Supporting | Admin dashboard: today's bookings, weekly occupancy rate | Read-only (queries, no aggregates) |

### 2.1 Context map

```
                 ┌────────────────────┐
                 │ Identity & Access  │
                 │   (identity)       │
                 └─────────┬──────────┘
                           │ memberId, isActive()   (via MemberDirectory port)
                           ▼
┌──────────────┐  spaceId, capacity   ┌──────────────────────┐
│ Space Catalog│ ───────────────────► │   BOOKING  (core)    │
│  (catalog)   │  (via SpaceDirectory)│                      │
└──────┬───────┘                      └──────────┬───────────┘
       │                                         │ domain events
       │ read                                    │ BookingConfirmed
       │                                         │ BookingRescheduled
       ▼                                         │ BookingCancelled
┌──────────────┐        read                     ▼
│  Reporting   │ ◄──────────────────  ┌──────────────────────┐
│ (reporting)  │                      │    Notifications     │
└──────────────┘                      │   (notification)     │
                                      └──────────────────────┘
                     Identity also emits: MemberRegistered,
                     PasswordResetRequested, RegistrationApproved
```

Relationships:
- **Booking → Identity / Catalog**: Booking only stores **IDs** (`memberId`,
  `spaceId`). It asks for the few facts it needs through **ports** defined in
  its own domain (`MemberDirectory`, `SpaceDirectory`), implemented in
  infrastructure. Booking never imports another context's entities.
- **Booking → Notifications**: publish/subscribe through domain events.
  Booking does not know that emails exist.
- **Reporting**: read-only access to Booking and Catalog data (SQL queries /
  read models). It never modifies them.

### 2.2 Ownership of cross-cutting features

| Feature (spec) | Context |
|---|---|
| Global search (spaces, bookings) | Presentation layer calling `catalog` + `booking` queries |
| PDF export of my bookings | `booking` (query) + infrastructure PDF adapter |
| Floor plan with current status colors | `catalog` (positions) + `booking` (current occupancy) |
| Responsive mobile | Frontend only |

---

## 3. Context details

### 3.1 Booking (core domain)

**Aggregate: `Booking`** (root)
- `id`, `memberId`, `spaceId`, `timeSlot: TimeSlot`, `status: BookingStatus`,
  `visibility: EventVisibility`, `attendeeCount`, `title?`, `seriesId?`

**Aggregate: `RecurringBooking`** (root)
- `id`, `memberId`, `spaceId`, `recurrenceRule: RecurrenceRule`, `timeRange`,
  `startDate`, `endDate`. It generates one `Booking` per occurrence.

**Value objects**: `TimeSlot`, `RecurrenceRule`, `BookingStatus`,
`EventVisibility`

**Domain service / policy**: `AvailabilityPolicy`. It checks that a time slot
does not overlap any active booking of the same space.

**Ports (interfaces in `domain/`)**: `BookingRepository`, `MemberDirectory`,
`SpaceDirectory`, `DomainEventPublisher`, `Clock`

**Business rules (invariants)**

| ID | Rule |
|---|---|
| BK-01 | A time slot ends strictly after it starts (`end > start`). |
| BK-02 | A time slot cannot start in the past. |
| BK-03 | **Two active bookings of the same space cannot overlap.** (core rule) |
| BK-04 | Only an **active** member can book. |
| BK-05 | A desk holds 1 person; a meeting room booking cannot exceed the room's capacity. |
| BK-06 | Only the owner (or an admin) can reschedule or cancel a booking. |
| BK-07 | A booking that has already started cannot be rescheduled or cancelled. |
| BK-08 | Rescheduling re-checks BK-01 to BK-05, ignoring the booking itself. |
| BK-09 | A recurring booking creates every available occurrence; conflicting occurrences are reported, not silently skipped. |
| BK-10 | Booking hours are limited to opening hours. |

**Use cases (application layer)**: `BookSpace`, `RescheduleBooking`,
`CancelBooking`, `BookRecurringSlot`, `CancelRecurringBooking`,
`GetWeeklyAvailability`, `ListMyBookings`, `GetBookingHistory`,
`SearchAvailableSpaces`, `ExportMyBookingsPdf`

**Domain events**: `BookingConfirmed`, `BookingRescheduled`,
`BookingCancelled`

**Safety net in infrastructure**: a PostgreSQL exclusion constraint on
`(space_id, tstzrange(start_at, end_at))` for active bookings. It guarantees
BK-03 even with concurrent requests.

### 3.2 Identity & Access

**Entity**: `Member` (root). Holds `email`, `passwordHash`, `profile`,
`role`, `accountStatus`.

**Value objects**: `EmailAddress`, `Profile` (firstName, lastName, phone,
photoUrl), `Role`, `AccountStatus`, `VerificationToken`, `PasswordResetToken`

**Account lifecycle**

```
register ──► PENDING_EMAIL_VERIFICATION ──verifyEmail──► PENDING_APPROVAL
                                                             │ approveRegistration (admin)
                                                             ▼
                                   INACTIVE ◄──deactivate── ACTIVE
                                            ──reactivate──►
```

| ID | Rule |
|---|---|
| ID-01 | An email address is unique and well-formed. |
| ID-02 | Passwords are never stored in clear text (hashed). |
| ID-03 | A member can log in only when `ACTIVE`. |
| ID-04 | Verification and reset tokens expire and are single-use. |
| ID-05 | Only an admin can approve, deactivate or reactivate a member. |

**Use cases**: `RegisterMember`, `VerifyEmail`, `ApproveRegistration`,
`LogIn`, `RequestPasswordReset`, `ResetPassword`, `UpdateProfile`,
`DeactivateMember`, `ReactivateMember`, `ListMembers`

**Domain events**: `MemberRegistered`, `RegistrationApproved`,
`PasswordResetRequested`

### 3.3 Space Catalog

**Entity**: `Space` (root). Holds `name`, `spaceType`, `capacity`,
`equipment[]`, `floorPlanPosition`, `isArchived`.

**Value objects**: `SpaceType` (`DESK`, `MEETING_ROOM`), `Capacity`,
`Equipment` (`PROJECTOR`, `SCREEN`, `WHITEBOARD`, `VIDEO_CONFERENCE`…),
`FloorPlanPosition`

| ID | Rule |
|---|---|
| SC-01 | A desk has a capacity of 1. |
| SC-02 | Capacity is a positive integer. |
| SC-03 | A space with future bookings is archived, not deleted. |

**Use cases**: `CreateSpace`, `UpdateSpace`, `ArchiveSpace`, `ListSpaces`,
`GetSpaceDetails`, `GetFloorPlan`

### 3.4 Notifications

Listens to domain events and sends emails (texts in **French**).

| Trigger | Notification |
|---|---|
| `MemberRegistered` | Email verification link |
| `RegistrationApproved` | Account approved |
| `PasswordResetRequested` | Password reset link |
| `BookingConfirmed` | Booking confirmation |
| `BookingRescheduled` | Booking update |
| `BookingCancelled` | Cancellation |
| Scheduled job (every N min) | Reminder 24h before start (`BookingReminderDue`) |

Port: `EmailSender` (Mailpit locally, SMTP provider in production).

### 3.5 Reporting

Read-only queries, no aggregates.
- `DailyBookingCount`: number of bookings for today.
- `WeeklyOccupancyRate` = booked hours / available hours of all spaces over
  the week.

---

## 4. Ubiquitous language — glossary

| Terme FR (métier) | Code name (EN) | DDD type | Context | Definition |
|---|---|---|---|---|
| Membre | `Member` | Entity (aggregate root) | identity | Person registered in the coworking space. |
| Administrateur / gérant | `Admin` (role `ADMIN`) | Value (Role) | identity | Member who manages spaces and members. |
| Rôle | `Role` | Value object | identity | `MEMBER` or `ADMIN`. |
| Statut du compte | `AccountStatus` | Value object | identity | `PENDING_EMAIL_VERIFICATION`, `PENDING_APPROVAL`, `ACTIVE`, `INACTIVE`. |
| Adresse e-mail | `EmailAddress` | Value object | identity | Valid, normalized (lowercase) email. |
| Profil | `Profile` | Value object | identity | First name, last name, phone, photo. |
| Inscription | `registration` / `RegisterMember` | Use case | identity | Account creation by a visitor. |
| Validation de l'e-mail | `VerifyEmail` | Use case | identity | Member confirms their email via a link. |
| Validation de l'inscription | `ApproveRegistration` | Use case | identity | Admin manually approves a new member. |
| Jeton de vérification | `VerificationToken` | Value object | identity | Single-use, expiring token sent by email. |
| Réinitialisation du mot de passe | `ResetPassword` / `PasswordResetToken` | Use case / VO | identity | Forgotten password flow. |
| Espace | `Space` | Entity (aggregate root) | catalog | Any bookable place (desk or room). |
| Type d'espace | `SpaceType` | Value object | catalog | `DESK` or `MEETING_ROOM`. |
| Poste de travail (open space) | `Desk` (`SpaceType.DESK`) | Value | catalog | Individual seat in the open space. |
| Salle de réunion | `MeetingRoom` (`SpaceType.MEETING_ROOM`) | Value | catalog | Closed room for several people. |
| Équipement | `Equipment` | Value object | catalog | Projector, screen, whiteboard… |
| Capacité / nombre de places | `Capacity` | Value object | catalog | Max number of people in a space. |
| Plan (architecte) | `FloorPlan` / `FloorPlanPosition` | Read model / VO | catalog | Layout of spaces with coordinates. |
| Réservation | `Booking` | Entity (aggregate root) | booking | A member's booking of a space for a time slot. |
| Créneau horaire | `TimeSlot` | Value object | booking | Immutable `[start, end[` interval; knows `overlaps()`. |
| Chevauchement | `overlaps()` | Method | booking | Two time slots share at least one instant. |
| Double réservation | `double-booking` / `SlotAlreadyBookedError` | Domain error | booking | Forbidden overlap on the same space (BK-03). |
| Disponibilité | `Availability` / `AvailabilityPolicy` | Domain service | booking | Whether a space is free on a time slot. |
| Réserver | `BookSpace` / `book()` | Use case | booking | Create a confirmed booking. |
| Modifier une réservation | `RescheduleBooking` / `reschedule()` | Use case | booking | Change the time slot (or space) of a booking. |
| Annuler une réservation | `CancelBooking` / `cancel()` | Use case | booking | Cancel a future booking. |
| Statut de réservation | `BookingStatus` | Value object | booking | `CONFIRMED`, `CANCELLED`. ("Past" is derived from the time slot.) |
| Réservation récurrente | `RecurringBooking` | Entity (aggregate root) | booking | Series of bookings following a rule. |
| Règle de récurrence | `RecurrenceRule` | Value object | booking | E.g. "every Tuesday morning" (weekly, day, time range). |
| Occurrence | `occurrence` (`Booking` with `seriesId`) | — | booking | One booking generated by a recurring booking. |
| Événement privé / public | `EventVisibility` (`PRIVATE` / `PUBLIC`) | Value object | booking | Whether other members can see the title/details. |
| Nombre de participants | `attendeeCount` | Attribute | booking | Must be ≤ space capacity. |
| Historique des réservations | `BookingHistory` / `GetBookingHistory` | Query | booking | Member's past bookings. |
| Calendrier hebdomadaire | `WeeklyAvailability` | Query / read model | booking | Free/booked slots per space for a week. |
| Réservation confirmée (événement) | `BookingConfirmed` | Domain event | booking | Emitted after a successful booking. |
| Réservation modifiée (événement) | `BookingRescheduled` | Domain event | booking | Emitted after a reschedule. |
| Réservation annulée (événement) | `BookingCancelled` | Domain event | booking | Emitted after a cancellation. |
| Rappel 24h | `BookingReminder` | Notification | notification | Email sent 24h before start. |
| Notification | `Notification` / `EmailSender` | Port | notification | Outgoing message to a member. |
| Tableau de bord | `Dashboard` | Read model | reporting | Admin overview. |
| Réservations du jour | `DailyBookingCount` | Query | reporting | Count of today's bookings. |
| Taux d'occupation | `OccupancyRate` / `WeeklyOccupancyRate` | Query | reporting | Booked hours / available hours. |

**Words to avoid in code**: `item`, `resource`, `slot` alone (use `TimeSlot`),
`reservation` (use `booking`), `user` in the domain (use `member`; `user` is
OK in auth infrastructure), `updateStatus(n)` (use intention-revealing
methods like `cancel()`).

---

## 5. Code organization

```
apps/api/src/
├── shared/                 # DomainError, DomainEvent, EventBus, Clock
├── booking/
│   ├── domain/             # Booking, TimeSlot, RecurrenceRule, AvailabilityPolicy, ports
│   ├── application/        # BookSpace, RescheduleBooking, CancelBooking, ...
│   ├── infrastructure/     # PrismaBookingRepository, InMemoryBookingRepository, PdfExporter
│   └── presentation/       # Fastify routes + request/response schemas
├── identity/   (same 4 folders)
├── catalog/    (same 4 folders)
├── notification/           # event handlers + EmailSender adapters
└── reporting/              # queries + routes
```

Dependency rule: `presentation → application → domain ← infrastructure`.
`domain/` imports nothing from Fastify, Prisma or any other context.
Domain unit tests use in-memory repositories (no database).

---

## 6. Open questions for the client

- Opening hours and minimum/maximum booking duration? 9-19 - 15min - 4hours
- Can a member hold several bookings at the same time (e.g. a desk + a room)? no
- Cancellation deadline (e.g. no cancellation less than 1h before)? 1hr
- Recurring booking: maximum horizon (e.g. 3 months)? What to do with conflicting occurrences? 3 months - warning, no booking made
- Private event: what exactly do other members see (busy slot only)? busy slot