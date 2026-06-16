-- supabase/seed.sql
-- Runs automatically after migrations on `supabase db reset` (config.toml -> [db.seed]).
-- Purpose: a deterministic DEV playground — one known, log-in-able account whose
-- memory_cards span the FSRS state/due spectrum, so the /review loop and the dashboard
-- can be exercised by hand without clicking through sign-up + note + card creation.
--
-- This is DEV-ONLY. It is never run on Vercel (preview/prod never call `db reset`); it
-- only ever touches your LOCAL Postgres. E2E specs do NOT depend on it — they self-seed
-- via the UI — so the two data lanes stay orthogonal.
--
-- Log in as either:
--   dev@example.com   / password123   -- minimal FSRS smoke-test bed (sections 1-4)
--   test@gmail.com    / test@Test      -- rich playground: 24 subjects, 60 notes,
--                                         cards + pending reviews (sections 5-9)
--
-- The test@gmail.com data is generated with deterministic UUIDs + `on conflict do
-- nothing`, so re-running this file is idempotent (unlike the dev memory_cards block).

-- ----------------------------------------------------------------------------
-- 1. A confirmed auth user. GoTrue needs BOTH auth.users and a matching
--    auth.identities row, a bcrypt password (pgcrypto's crypt/gen_salt), and
--    empty-string (not NULL) token columns — NULLs break some GoTrue queries.
--    Fixed UUID so every reset reproduces the same owner id.
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'authenticated', 'authenticated',
  'dev@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
)
values (
  gen_random_uuid(),
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","email":"dev@example.com"}',
  'email',
  now(), now(), now()
)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 2. One subject note to hang cards off of. user_id is set explicitly: seed runs
--    as postgres (RLS-bypassing, auth.uid() is NULL here), so the column default
--    `auth.uid()` would insert NULL and violate NOT NULL.
-- ----------------------------------------------------------------------------
insert into notes (id, user_id, title, content)
values (
  '11111111-1111-4111-8111-111111111111',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'FSRS smoke-test note',
  e'# Spaced repetition test bed\n\nCards below span every FSRS state and due window.'
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. memory_cards across the FSRS spectrum. state: 0=New 1=Learning 2=Review 3=Relearning.
--    The /review "due" query is `due_at <= now()`, so anything past/now appears in a
--    session and anything future is hidden — giving you a visible due-count and a
--    "come back later" empty state to verify in one seed.
-- ----------------------------------------------------------------------------
insert into memory_cards (
  user_id, note_id, prompt, example, code_context,
  state, stability, difficulty, elapsed_days, scheduled_days,
  learning_steps, reps, lapses, due_at, last_review
)
values
  -- New card, never reviewed, due now. Exercises the createEmptyCard path + first grade.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'What does `state = 0` mean in FSRS?', 'A brand-new card.', null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),

  -- Learning card, due now.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'Recall the FSRS learning steps.', null, null,
   1, 1.2, 5.0, 0, 0, 1, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),

  -- OVERDUE review card (due 3 days ago). Should headline the due list.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'Explain stability vs. difficulty in FSRS.',
   'stability = days until R drops to 90%; difficulty = intrinsic hardness.', null,
   2, 8.0, 5.5, 7, 4, 0, 3, 0, now() - interval '3 days', now() - interval '7 days'),

  -- Review card due right now (boundary case for `<= now()`).
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'What does `record_review` persist atomically?', null,
   e'```sql\nupdate memory_cards ... ; insert into review_events ...\n```',
   2, 4.0, 6.0, 2, 2, 0, 2, 1, now(), now() - interval '2 days'),

  -- FUTURE review card (due in 5 days) — NOT due, must be hidden from /review.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'Why is this card not in today''s session?', 'Because due_at > now().', null,
   2, 12.0, 4.0, 1, 5, 0, 4, 0, now() + interval '5 days', now() - interval '1 day'),

  -- MATURE review card: stability past the 21-day maturity line, so the dashboard
  -- "By maturity" chart shows a non-empty mature ring. Long interval => not due.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'What makes a card "mature" in this app?', 'Stability >= 21 days (MATURE_STABILITY_DAYS).', null,
   2, 45.0, 3.5, 30, 35, 0, 6, 0, now() + interval '25 days', now() - interval '10 days');

-- ----------------------------------------------------------------------------
-- 4. A handful of past review_events so the dashboard heatmap/stats render with
--    real history instead of an empty grid. rating is FSRS 1..4 (Again..Easy).
-- ----------------------------------------------------------------------------
insert into review_events (user_id, memory_card_id, rating, reviewed_at)
select
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  tc.id,
  1 + (floor(random() * 4))::smallint,            -- 1..4
  now() - (g.d || ' days')::interval
from memory_cards tc
cross join generate_series(0, 6) as g(d)
where tc.user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  and tc.note_id = '11111111-1111-4111-8111-111111111111'
limit 20;

-- ============================================================================
-- test@gmail.com — REAL-CONTENT playground, generated from learning notes by
-- supabase/seed-scripts/generate-section-seed.mjs. Replaces the old synthetic
-- 24-subject/60-note block. Section: Python — Functional Programming.
-- Source notes: /Users/konradantonik/workspace/learning/python/functional_p/functional_programming_py_notes.md
-- Source cards: /Users/konradantonik/workspace/learning/flashcards/python_functional/functional_programming_flashcards.md
-- 52 notes, 70 cards across 21 card-groups.
-- ============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'authenticated', 'authenticated',
  'test@gmail.com',
  crypt('test@Test', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
)
values (
  gen_random_uuid(),
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","email":"test@gmail.com"}',
  'email',
  now(), now(), now()
)
on conflict do nothing;

insert into subjects (id, user_id, title, description) values
  ('5b1ec700-0000-4000-8000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Python — Functional Programming$seed$, $seed$Functional programming in Python: pure functions, higher-order functions, closures, currying, decorators, recursion. Seeded from real learning notes.$seed$)
on conflict (id) do nothing;

insert into notes (id, user_id, title, content, subject_id, position) values
  ('0a7e0000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Imperative (procedural) programming$seed$, $seed$We need to declare both what we want to happen and how we want it to happen.

Imperative:

```py
car = create_car()
car.add_gas(10)
car.clean_windows()
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 1),
  ('0a7e0000-0000-4000-8000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Declarative programming$seed$, $seed$```py
return clean_windows(add_gas(create_car()))
```

We never change the car variable, we are creating new values (immutability).

Focus on `what` we want to happen not `how` it should happen.

Functional programming is all about `creating functions instead of mutating state`.

`Main purpose of functional programming is to make our code more declarative.`

Great example of declarative programming is css
We don't care about all the steps, we just want to change the color of each button on the page.

```css
button {
  color: red;
}
```

`Hiding implementation on the low level` is declarative programming.

This is an example of imperative programming where we define each step.

```py
def get_average(nums):
    total = 0
    for num in nums:
        total += num
    return total / len(nums)
```

And with declarative approach:

```py
def get_average(nums):
    return sum(nums) / len(nums)
```

We do not keep track of the state (total), we only care about the result.$seed$, '5b1ec700-0000-4000-8000-000000000001', 2),
  ('0a7e0000-0000-4000-8000-000000000003', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Functional programming basic concepts$seed$, $seed$- higher order functions
- first class functions
- pure functions
- recursion
- closures
- currying$seed$, '5b1ec700-0000-4000-8000-000000000001', 3),
  ('0a7e0000-0000-4000-8000-000000000004', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Immutability$seed$, $seed$Once the val is created it never changes.  
Immutable data is easier to think about and work with. When 10 different functions have access to the same variable, and you're debugging a problem with that variable, you have to consider the possibility that any of those functions could have changed the value.

When a variable is immutable, you can be sure that it hasn't changed since it was created. It's a helluva lot easier to work with.

Generally speaking, `immutability means fewer bugs and more maintainable code.`$seed$, '5b1ec700-0000-4000-8000-000000000001', 4),
  ('0a7e0000-0000-4000-8000-000000000005', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Tuples vs Lists$seed$, $seed$Both ordered sets of vals but
`tuples are immutable` - you can not append to a tuple. You can create a new copy of a tuple with added value.

```py
ages = (16, 21, 30)
more_ages = (80,)
# note the comma! It's required for a single-element tuple
# 'all_ages' is a brand new tuple
all_ages = ages + more_ages
# (16, 21, 30, 80)

# or we can even reassign the same variable to point to a new tuple:
ages = ages + more_ages
# (16, 21, 30, 80)
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 5),
  ('0a7e0000-0000-4000-8000-000000000006', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$sorted()$seed$, $seed$Sort items in the list

```py
def get_median_font_size(font_sizes):
    length = len(font_sizes)
    if length == 0 :
        return None
    sorted_sizes = sorted(font_sizes)
    if length % 2 == 0:
        return sorted_sizes[length // 2 - 1 ]
    return sorted_sizes[length // 2]
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 6),
  ('0a7e0000-0000-4000-8000-000000000007', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Classes vs functions$seed$, $seed$Functional programming and object-oriented programming are `styles for writing code`.

Of the `four pillars of OOP (inheritance, polymorphism, abstraction encapsulation)`, inheritance is the only one that doesn't fit with functional programming.

Default to functions. If we need something stateful and long-lived we might reach for classes.

Classes encourage you to think about the `world as a hierarchical collection of objects`. Objects bundle behavior, data, and state together

Functions encourage you to think about the world as a series of data transformations. Functions take data as input and return a transformed output.$seed$, '5b1ec700-0000-4000-8000-000000000001', 7),
  ('0a7e0000-0000-4000-8000-000000000008', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$strip() #replace() #upper()$seed$, $seed$Equivalent of trim

variations:

- `lstrip()` - trims left hand side
- `rstrip()` - trims right hand side

```py
def format_line(line):
    stripped = line.strip()
    capitalized = stripped.upper()
    removedPeriods = capitalized.replace('.', '')
    appended = f"{removedPeriods}..."
    return appended
    # return f"{line.rstrip().capitalize().replace(',', '')}...."
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 8),
  ('0a7e0000-0000-4000-8000-000000000009', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Statements vs Expressions$seed$, $seed$`Statements - actions to be carried out.`  
"Set n to 7"  
"Define a function named greet"  
"If x > 10, print a greeting to Alice"

```py
n = 7  # Variable assignment statement

def greet(name):  # Function definition statement
    return f"Hello, {name}!"

if x > 10:  # `if` statement
    print(greet("Alice"))

for i in range(n):  # `for` loop statement
    print(i)
```

Expressions are a `subset of statements that produce values`.

Every function call is an expression!  
Even if a Python function doesn't have a return statement, it still implicitly returns None.

```py
result = 2 + 2  # Arithmetic expression
length = len("hello")  # Function call expression
total_cost = len(items) * cost  # Multiple expressions combined into one
```

Because `expressions produce values they are reusable and declarative`.  
In functional programming we should aim to use expressions over statements.  
Expression:

```py
return sum([1, 2, 3])
```

We could do that in a series of steps but we would have to combine expressions:

```py
total = 0
for n in [1, 2, 3, 4]:
    total += n
```

`Expressions are reusable, declarative, do not mutate values and minize side effects`$seed$, '5b1ec700-0000-4000-8000-000000000001', 9),
  ('0a7e0000-0000-4000-8000-000000000010', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Ternary expression$seed$, $seed$We can change

```py
result = 0
if number % 2 ==0:
    result = number  / 2
else:
    result = (numer * 3 ) + 1
```

To a ternary expression and avoid mutating state!

```py
result = number / 2 if number % 2 == 0 else (number * 3) + 1
```

Like in js we should not overuse it as they tend to be hard to read$seed$, '5b1ec700-0000-4000-8000-000000000001', 10),
  ('0a7e0000-0000-4000-8000-000000000011', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$First Class functions$seed$, $seed$`First class functions` means that a function in python can be treated like any other object

- assigned to a value (functions as values)
- passed as arguments to other functions
- returned from a function
- stored in a data structure

In python functions are just values, so we can assign a function to a variable

```py
def foo(a, b:
    return a + b

sum_foo = foo
print(sum_foo(2, 2)) # 4
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 11),
  ('0a7e0000-0000-4000-8000-000000000012', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Anonymous functions - lambda$seed$, $seed$In python unnamed functions are called `lambda `.  
Example of a functions that takes `x` as an argument and returns `x + 1`

```py
lambda x: x + 1
```

We can assing it to a variable

```py
addone = lambda x: x + 1
```

It is equivalent of:

```js
const addOne = (x) => x + 1;
```

Like in js result of a function expression is returned automaticaly.

```py
myDictionary = {
    "name": "Konrad",
    "age": "9"
}

get_age = lambda name: myDictionary.get(name)
get_age = lambda name: myDictionary.get(name, 'not found')
print(get_age('name')) # Konrad
print(get_age('not found test ')) # not found
```

Example of function returned from another function

```py
def file_type_getter(file_extension_tuples):
    file_extensions_dict = {}
    for tup in file_extension_tuples:
        for ext in tup[1]:
            file_extensions_dict[ext] = tup[0]
    return lambda ext: file_extensions_dict.get(ext, "Unknown")

```$seed$, '5b1ec700-0000-4000-8000-000000000001', 12),
  ('0a7e0000-0000-4000-8000-000000000013', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Higher order function$seed$, $seed$`Function that takes another function as an argument`

```py
def square(x):
    return x * x

def my_map(func, args):
    result = []
    for arg in args:
        result.append(func(arg))
    return result

squares = my_map(square, [1, 2, 3, 4] )
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 13),
  ('0a7e0000-0000-4000-8000-000000000014', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$map + list()$seed$, $seed$`map, filter and reduce are higher order functions`

```py
def square(x):
    return x * x

nums = [1, 2, 3, 4]
squared_nums = map(square, nums)
print(list(squared_nums))
print(map(square, [1, 2, 3, 4]))
# This will not work <map object at 0x1004369a0>
```

Map returns a `map object` that is why we need a `list` constructor to convert it to list

```py
def change_bullet_style(document):
    lines = document.split("\n")
    converted = map(convert_line, lines )
    return "\n".join(converted)

def convert_line(line):
    old_bullet = "-"
    new_bullet = "*"
    if len(line) > 0 and line[0] == old_bullet:
        return new_bullet + line[1:]
    return line
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 14),
  ('0a7e0000-0000-4000-8000-000000000015', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$filter()$seed$, $seed$Similar syntax like in map, behaviour same like in js.
We can even use lambda inside like we would use a callback in js

```py
def is_even(x):
    return x % 2 == 0

numbers = [1, 2, 3, 4, 5, 6]
evens = list(filter(lambda x: x % 2 == 0, numbers))
print(evens)
# [2, 4, 6]
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 15),
  ('0a7e0000-0000-4000-8000-000000000016', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$functools.reduce()$seed$, $seed$- it needs to be imported before use
- takes two arguments
- we can add an initial val for accumulator

```py
import functools
def add(acc, x):
    print(f"{acc}, x: {x}")
    return acc + x

numbers = [1, 2, 3, 4]
total = functools.reduce(add, numbers)

print(total)
```

lambda version  
💡 In python lambda version can only contain single expression!  
It means that I can't for example print something and than return like I could in a js callback

```py
number = [1, 2, 3, 4 ]
total = functools.reduce(lambda a, b: a + b, number)
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 16),
  ('0a7e0000-0000-4000-8000-000000000017', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$zip$seed$, $seed$Take to iterables and combine them into a new iterable where each element is a tuple containig one element from each of the original iterables

```py
    a = [1, 2, 3]
    b = [1, 2, 3]


    c = list(zip(a,b))
    # [(1, 1), (2, 2), (3, 3)]
```

💡 Iterables has to be of the same len, if this is not the case, returned element will only return elements where a pair can actually be created:

```py
    a = [1, 2, 3, 4, 5]
    b = [1, 2, 3]

    zipped = zip(a,b)
    # print(type(zipped)) # <class 'zip'>

    c = list(zip(a,b))
    # [(1, 1), (2, 2), (3, 3)]
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 17),
  ('0a7e0000-0000-4000-8000-000000000018', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$type(variable)$seed$, $seed$Returns a type of a variable$seed$, '5b1ec700-0000-4000-8000-000000000001', 18),
  ('0a7e0000-0000-4000-8000-000000000019', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$sort() vs sorted()$seed$, $seed$arr.sort() - mutates original arr
arr.sorted() - returns sorted arr$seed$, '5b1ec700-0000-4000-8000-000000000001', 19),
  ('0a7e0000-0000-4000-8000-000000000020', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$pure functions$seed$, $seed$In majority of situations you want to use pure functions.

- `Always return the same values given the same arguments`
- `Cause no side effects`

Thanks to this they are predictible, easy to debug, always work the same.  
`No works on my machine problem.`

Example of pure function

```python
def add(x, y):
    return x + y
    # same result every time
```

Example of impure function:

```python

total = 0
def dirty_add(x):
    global total
    # global keyword is necessary to access global variable
    total = total + x
    return total

print(dirty_add(10)) # 10
print(dirty_add(10)) # 20
print(dirty_add(10)) # 30
# different result every time, updating global value
```

So why we need to use unpure functions sometimes?  
Because we need side effects every now and then.$seed$, '5b1ec700-0000-4000-8000-000000000001', 20),
  ('0a7e0000-0000-4000-8000-000000000021', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Side Effects include:$seed$, $seed$`Anything that the function does, except returning a value`

- printing to the console
- updating db
- accessing internet
- modyfing global variables or anything outside it's scope (no state mutation)
- modyfing it's input
- writing to a file
- I/O operations

A program that has no side effects is effectively useless.$seed$, '5b1ec700-0000-4000-8000-000000000001', 21),
  ('0a7e0000-0000-4000-8000-000000000022', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$References vs Copies$seed$, $seed$Works almost like in js.
Collections are passed as references, `except tuples!`.

When you pass a value into a function as an argument, one of two things can happen:

1. It's `passed by reference`: The function has access to the original value and can change it.
2. It's `passed by value`: The function only has access to a copy. Changes to the copy within the function don't affect the original.

These types are passed by reference:
Lists  
Dictionaries  
Sets

These types are passed by value:
Integers  
Floats  
Strings  
Booleans  
Tuples

Reference:

```py
def modify_list(inner_lst):
    inner_lst.append(4)
    # the original "outer_lst" is updated
    # because inner_lst is a reference to the original

outer_lst = [1, 2, 3]
modify_list(outer_lst)
# outer_lst = [1, 2, 3, 4]
```

No reference

```py

def attempt_to_modify(inner_num):
    inner_num += 1
    # the original "outer_num" is not updated
    # because inner_num is a copy of the original

outer_num = 1
attempt_to_modify(outer_num)
# outer_num = 1
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 22),
  ('0a7e0000-0000-4000-8000-000000000023', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$obj.copy()$seed$, $seed$A way to avoid mutating original object.

```py
def add_format(default_formats, new_format):
    updated = default_formats.copy()
    updated[new_format] = True
    return updated
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 23),
  ('0a7e0000-0000-4000-8000-000000000024', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Copying a list - copy$seed$, $seed$To get a new copy of a list, use the copy() method. If you just do new_list = old_list, your new variable will just
be a reference to the original list.

```python
    import copy

    nums = [4, 3, 2, 1]
    nums_copy = nums.copy()
    # nums_copy is [4, 3, 2, 1]

```$seed$, '5b1ec700-0000-4000-8000-000000000001', 24),
  ('0a7e0000-0000-4000-8000-000000000025', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Delete from a list$seed$, $seed$```python
    fruits = ["apple", "banana", "cherry", "kiwi"]
    del fruits[1]
    # fruits is ["apple", "cherry", "kiwi"]
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 25),
  ('0a7e0000-0000-4000-8000-000000000026', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$I/O$seed$, $seed$The term "i/o" stands for `input/output.` In the context of writing programs, i/o refers to anything in our code that interacts with the "outside world". "Outside world" just means anything that's not stored in our application's memory (like variables).  
All i/o is a form of "side effect". (including print)  
In functional programming, i/o is viewed as dirty but necessary.$seed$, '5b1ec700-0000-4000-8000-000000000001', 26),
  ('0a7e0000-0000-4000-8000-000000000027', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$No-Op$seed$, $seed$`Operation that does nothing`

If a function doesn't return anything it is probably impure, and is performing some side effects.

No-Op example:

```py
def square(x):
    x * x
```

Side effect example:

```py
myGlobal = 0

def impure(x):
    global myGlobal
    myGlobal + x
```

The global keyword just tells Python to allow modification of the outer-scoped y variable.$seed$, '5b1ec700-0000-4000-8000-000000000001', 27),
  ('0a7e0000-0000-4000-8000-000000000028', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Memoization$seed$, $seed$In simple terms memoization is basically storing a copy (caching) of a result of a computation so that we don't have to calculate it again int the future.

```py

def word_count_memo(document, memos):
    memosCopy = memos.copy()

    # Avoid counting again
    if document in memosCopy:
        return memosCopy[document], memosCopy

    count = word_count(document)
    memosCopy[document] = count
    return count, memosCopy

def word_count(document):
    count = len(document.split())
    return count
```

`Pure functions always can be safely memoized and impure can't`
That is why we have dependency array to recalculate memoized val when using useMemo() in React.

`Memoization is not free` - there is always a trade off between using RAM memory and speed. If function is fast enough it should'nt$seed$, '5b1ec700-0000-4000-8000-000000000001', 28),
  ('0a7e0000-0000-4000-8000-000000000029', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Referential Transparency$seed$, $seed$`Pure functions are always referentialy transparent` meaning that pure functions can always be replaced by it's would be return value. Since this value is always the same every time.

For example:

```py
add(2, 3)
```

Can simply be replaced with 5$seed$, '5b1ec700-0000-4000-8000-000000000001', 29),
  ('0a7e0000-0000-4000-8000-000000000030', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$str to arr$seed$, $seed$```py
str = 'str'
print(list(str))
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 30),
  ('0a7e0000-0000-4000-8000-000000000031', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$sorted with a function$seed$, $seed$This will be performed on each item
the transformation is only temporary for sorting. The key parameter in sorted() creates a "sort key" - it transforms each element just enough to make comparisons work, but returns the original elements in the sorted order.

```p6
def transform_date(date_str):
    month, day, year = date_str.split("-")  # "07-21-2023" -> ["07", "21", "2023"]
    return year + month + day               # -> "20230721"

def sort_dates(dates):
    # sorted() calls transform_date on each date to get sort keys:
    # '07-21-2023' -> '20230721'
    # '12-25-2022' -> '20221225'
    # '01-01-2023' -> '20230101'
    # etc.

    # It sorts by these keys, then returns the ORIGINAL date strings
    return sorted(dates, key=transform_date)
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 31),
  ('0a7e0000-0000-4000-8000-000000000032', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$recursion$seed$, $seed$`Function that calls itself`

```py
def sum_nums(nums):
    # base case
    if len(nums) == 0:
        return 0
    return nums[0] + sum_nums(nums[1:])

print(sum_nums([1, 2, 3, 4, 5]))
# 15


def foo_countdown(x):
    # base case
    if x ==0:
        return
    print(x)
    foo_countdown(x-1)


```

`Base case` - without it recursive function calls would just create a `stack overflow`.

Recursion is fundamental to functional programming because we do not have to create stateful loops!

Recursion is often used in "tree-like" structures. For example:

Nested dictionaries
File systems
HTML documents
JSON objects

If iterating over a one-dimensional list then a loopis typically simpler, even if it's not as "pure" in the academic sense.  
That's because trees can have unknown depth. It's hard to write a series of loops because you don't know how many levels deep the tree goes.

```py
for item in tree:
    for nested_item in item:
        for nested_nested_item in nested_item:
            for nested_nested_nested_item in nested_nested_item:
                # ... WHEN DOES IT END???
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 32),
  ('0a7e0000-0000-4000-8000-000000000033', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Stack Overflow$seed$, $seed$Stack Overflow: Each function call requires a bit of memory. So, if you recurse too deeply, you can run out of "stack" memory which will crash your program. (This is what the famous website is named after)

If you don't have a solid base case, you can end up in an infinite loop (which will likely lead to a stack overflow).

Recursion (especially in a language like Python) is often slower than a for loop because each function call requires some memory.$seed$, '5b1ec700-0000-4000-8000-000000000001', 33),
  ('0a7e0000-0000-4000-8000-000000000034', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$isinstance()$seed$, $seed$Returns true if an element is an instance of a certain type

```py
isinstance(item, list):
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 34),
  ('0a7e0000-0000-4000-8000-000000000035', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$.split(maxsplit=int)$seed$, $seed$$seed$, '5b1ec700-0000-4000-8000-000000000001', 35),
  ('0a7e0000-0000-4000-8000-000000000036', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$function transformations$seed$, $seed$A specific type of higher order function - `a function that takes another function as an argument nad returns a new function.`

```py
def multiply(x, y):
    return x * y

def add(x, y):
    return x + y

# self_math is a higher order function
# input: a function that takes two arguments and returns a value
# output: a new function that takes one argument and returns a value
def self_math(math_func):
    def inner_func(x):
        return math_func(x, x)
    return inner_func

square_func = self_math(multiply)
double_func = self_math(add)

print(square_func(5))
# prints 25

print(double_func(5))
# prints 10
```

You can use .split with maxsplit=1.
That will split a string into a list of [first_word, rest_of_string]

Why would we even want to use function transformations?
In most cases it's because we wamnt to share some funcionality.

This formatter function. It accepts a "pattern" and returns a new function that formats text according to that pattern. Without it we would have to create three separate functions.

❗️Not necessarily but it is more flexible
When single function makes more sense:
When patterns are dynamic or user-provided
When you don't need to create multiple specialized functions
When simplicity is preferred over partial application

```py
def formatter(pattern):
    def inner_func(text):
        result = ""
        i = 0
        while i < len(pattern):
            if pattern[i:i+2] == '{}':
                result += text
                i += 2
            else:
                result += pattern[i]
                i += 1
        return result
    return inner_func

bold_formatter = formatter("**{}**")
italic_formatter = formatter("*{}*")
bullet_point_formatter = formatter("* {}")

print(bold_formatter("Hello"))
# **Hello**
print(italic_formatter("Hello"))
# *Hello*
print(bullet_point_formatter("Hello"))
# * Hello
```

`90 % of times we want to use function transformations to create closures`.$seed$, '5b1ec700-0000-4000-8000-000000000001', 36),
  ('0a7e0000-0000-4000-8000-000000000037', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$closures$seed$, $seed$`Function that references variables from outside this function body.`
Put simply, a closure is just a function that keeps track of some values from the place where it was defined, no matter where it is executed later on.

`The whole point of a closure is that it's stateful`. It's a function that "remembers" the values from the enclosing scope even after the enclosing scope has finished executing.

It's as if you're saving the state of a function at a particular point in time, and then you can use and update that state later on.

The concatter() function returns a function called doc_builder (yay higher-order functions!) that has a reference to an enclosed doc value.

```py
def concatter():
	doc = ""
	def doc_builder(word):
		# "nonlocal" tells Python to use the 'doc'
		# variable from the enclosing scope
		nonlocal doc
		doc += word + " "
		return doc
	return doc_builder

# save the returned 'doc_builder' function
# to the new function 'harry_potter_aggregator'
harry_potter_aggregator = concatter()
harry_potter_aggregator("Mr.")
harry_potter_aggregator("and")
harry_potter_aggregator("Mrs.")
harry_potter_aggregator("Dursley")
harry_potter_aggregator("of")
harry_potter_aggregator("number")
harry_potter_aggregator("four,")
harry_potter_aggregator("Privet")

print(harry_potter_aggregator("Drive"))
# Mr. and Mrs. Dursley of number four, Privet Drive
```

When concatter() is called, it creates a new "stateful" function that remembers the value of its internal doc variable. Each successive call to harry_potter_aggregator appends to that same doc.

`nonlocal`
Python has a keyword called `nonlocal that's required to modify a variable from an enclosing scope`. Most programming languages don't require this keyword, but Python does.
When variable is mutable we do not use nonlocal - we are simply changing referenced obj.
nonlocal keyword if you are reassigning a variable instead of modifying its contents (which you must do to change immutable values such as strings and integers).

No nonlocal needed:

```py
def new_collection(initial_docs):
    init_copy = initial_docs.copy()
    def foo(str):
        init_copy.append(str)
        return init_copy
    return foo

```$seed$, '5b1ec700-0000-4000-8000-000000000001', 37),
  ('0a7e0000-0000-4000-8000-000000000038', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$copy.deepcopy()$seed$, $seed$.copy() method will produce a shallow copy - if we need we can use deepcopy() instead.

```py
    deep_copy = copy.deepcopy(initial_styles)
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 38),
  ('0a7e0000-0000-4000-8000-000000000039', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$currying$seed$, $seed$`Function transformation where we transform a single function that accepts mutliple arguments into multiple functions that each accepts a single argument`

```py
def sum(a, b):
  return a + b

print(sum(1, 2))
# prints 3
```

Curried:

```py
def sum(a):
  def inner_sum(b):
    return a + b
  return inner_sum

print(sum(1)(2))
# prints 3
```

Reasons for currying

- Changing function signature to make it conform to a specific shape for example requrired by some external tool

```py
def colorize(converter, doc):
  # ...
  converter(doc)
  # ...
```

The colorize function accepts a function called converter as input, and at some point during its execution, it calls converter with a single argument. That means that it expects converter to accept exactly one argument. So, if I have a conversion function like this:

```py

def markdown_to_html(doc, asterisk_style):
  # ...
```

I can't pass markdown_to_html to colorize because markdown_to_html wants two arguments. To solve this problem, I can curry markdown_to_html into a function that takes a single argument:

```py
def markdown_to_html(asterisk_style):
  def asterisk_md_to_html(doc):
    # do stuff with doc and asterisk_style...

  return asterisk_md_to_html

markdown_to_html_italic = markdown_to_html('italic')
colorize(markdown_to_html_italic, doc)
```

Is not used very often though.

We can also store curried function calls in separate variables

```py

def box_volume(length):
  def box_volume_with_len(width):
    def box_volume_with_len_width(height):
      return length * width * height
    return box_volume_with_len_width
  return box_volume_with_len


final_volume = box_volume(3)(4)(5)
print(final_volume)
# 60

with_length_3 = box_volume(3)
with_len_3_width_4 = with_length_3(4)
final_volume = with_len_3_width_4(5)
print(final_volume)
# 60

```$seed$, '5b1ec700-0000-4000-8000-000000000001', 39),
  ('0a7e0000-0000-4000-8000-000000000040', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$decorators$seed$, $seed$Basically a `syntactic sugar around function transformations` (returning a function by another function).  
It is an often simpler way of writing higher order function.

```py
def vowel_counter(func_to_decorate):
    vowel_count = 0
    def wrapper(doc):
        nonlocal vowel_count
        vowels = "aeiou"
        for char in doc:
            if char.lower() in vowels:
                vowel_count += 1
        print(f"Vowel count: {vowel_count}")
        return func_to_decorate(doc)
    return wrapper


# 1. Without decorator
def myFoo(val):
    print(val)

tt = vowel_counter(myFoo)
tt('sialalalalala ')
#Vowel count: 7
# sialalalalala 🍆

# 2. With decorator
@vowel_counter
def myFooIsNowDecorated(val):
    print(val)

myFooIsNowDecorated('sialalala 🍆')
# Vowel count: 5
# sialalala 🍆
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 40),
  ('0a7e0000-0000-4000-8000-000000000041', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$args and kwargs$seed$, $seed$`*args` - collects positional arguments into a tuple (order matters)
`**kwargs` - collects keyword (named) arguments into a dictionary

```py
def print_arguments(*args, **kwargs):
    print(f"Positional arguments: {args}")
    print(f"Keyword arguments: {kwargs}")

print_arguments("hello", "world", a=1, b=2)
# Positional arguments: ('hello', 'world')
# Keyword arguments: {'a': 1, 'b': 2}
```

`Positional arguments` - args where order of args matter, switching order might result in a different output

```py
def sub(a, b):
    return a - b

# a=3, b=2
res = sub(3, 2)
# res = 1

```

`Keyword args` - passed by name, `order does not matter`

```py
def sub(a, b):
    return a - b

res = sub(b=3, a=2)
# res = -1
res = sub(a=3, b=2)
# res = 1
```

❗️ Any positional args must come before keyword args.

```py
# ❌ This will not work:
res = sub(b=3, 2)
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 41),
  ('0a7e0000-0000-4000-8000-000000000042', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$enumerate$seed$, $seed$If we are looping over an iterable and we need access to index we can use enumerate:

```py
   for index, item in enumerate(args):
        print(f"{index + 1}. {item}")
```

Or we can use range, but enumerate is more readable

```py
for i in range(len(args)):
        print(f"Index: {i}, Item: {args[i]}")
```

Enumarate is better because:
No manual indexing: Direct access to both index and item
No length calculation: More efficient for large iterables
Immutable pairs: Can't accidentally modify the wrong element
Cleaner syntax: Expresses intent more clearly$seed$, '5b1ec700-0000-4000-8000-000000000001', 42),
  ('0a7e0000-0000-4000-8000-000000000043', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$sorting by key$seed$, $seed$```py
dict = {"key": "val"}
sorted_by_key = sorted(dict.keys())
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 43),
  ('0a7e0000-0000-4000-8000-000000000044', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$tuple unpacking$seed$, $seed$```py
tuple = ("Konrad", "Antonik", "Scholar level 55")
print(*tuple)
# Konrad Antonik Scholar level 55
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 44),
  ('0a7e0000-0000-4000-8000-000000000045', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$dict unpacking$seed$, $seed$❌ This will not work
Print does not have a name method

```py
my_dict = {"name": "Konrad", "age": 38}

print(**my_dict)
```

Dictionary unpacking with `**` converts the dict keys into keyword arguments for the function call.

✅ this will work - functions accepts those keywords

```py
def greet(name, age):
    print(f"Hello {name}, you are {age}")

my_dict = {"name": "Konrad", "age": 38}
greet(**my_dict)  # Works: equivalent to greet(name="Konrad", age=38)
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 45),
  ('0a7e0000-0000-4000-8000-000000000046', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$dict()$seed$, $seed$Transforms a key val pairs into dictionary

```py
# List of tuples
dict([('a', 1), ('b', 2)])

# List of lists
dict([['a', 1], ['b', 2]])

# Tuple of tuples
dict((('a', 1), ('b', 2)))

# Mixed sequences
dict([['a', 1], ('b', 2)])
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 46),
  ('0a7e0000-0000-4000-8000-000000000047', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$lru_cache$seed$, $seed$lru_cache from the functools module is an example of a decorator and an example of memoization.

lru_cache memoizes the inputs and outputs of the decorated function in a size-restricted dictionary. It speeds up repeated calls to a slow function with the same inputs. For instance, if the function reads from disk, makes network requests, or requires a lot of computation AND it is used repeatedly with the same inputs.

Since the factorial function is recursive and the inputs are sequential numbers, it's called repeatedly with the same inputs. Without the cache, the function would be called 30 times. With lru_cache, the function is only called 13 times. While you don't often need to compute factorials, this example ties together how to use a decorator and memoization and recursion.

```py
from functools import lru_cache

@lru_cache()
def factorial_r(x):
    if x == 0:
        return 1
    else:
        return x * factorial_r(x - 1)

factorial_r(10) # no previously cached result, makes 11 recursive calls
# 3628800
factorial_r(5)  # just looks up cached value result
# 120
factorial_r(12) # makes two new recursive calls, the other 11 are cached
# 479001600
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 47),
  ('0a7e0000-0000-4000-8000-000000000048', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$stacking decorators + currying$seed$, $seed$```py
def to_uppercase(func):
    def wrapper(document):
        return func(document.upper())

    return wrapper

def get_truncate(length):
    def truncate(func):
        def wrapper(document):
            return func(document[:length])525416

        return wrapper

    return truncate

@to_uppercase
@get_truncate(9) # currying
def print_input(input):
    print(input)

print_input("Keep Calm and Carry On")
# prints: "KEEP CALM"
```

Observe that to_uppercase wrapped get_truncate(9), and get_truncate(9) returned truncate which wrapped print_input, then print_input printed "KEEP CALM" from "Keep Calm and Carry On".$seed$, '5b1ec700-0000-4000-8000-000000000001', 48),
  ('0a7e0000-0000-4000-8000-000000000049', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Sum types$seed$, $seed$We can reduce the number of cases our code needs to handle by using a (admittedly fake Pythonic) sum type with only 3 possible types.

Then we can use the isinstance built-in function to check if a Person is an instance of one of the subclasses. It's a clunky way to represent sum types, but hey, it's Python.

```py
class Person:
    def __init__(self, name):
        self.name = name

class Dateable(Person):
    pass

class MaybeDateable(Person):
    pass

class Undateable(Person):
    pass

def respond_to_text(guy_at_bar):
    if isinstance(guy_at_bar, Dateable):
        return f"Hey {guy_at_bar.name}, I'd love to go out with you!"
    elif isinstance(guy_at_bar, MaybeDateable):
        return f"Hey {guy_at_bar.name}, I'm busy but let's hang out sometime later."
    elif isinstance(guy_at_bar, Undateable):
        return "Have you tried being rich?"
    else:
        raise ValueError("invalid person type")

```

This works as a python way of type checking but better way is to use Enums$seed$, '5b1ec700-0000-4000-8000-000000000001', 49),
  ('0a7e0000-0000-4000-8000-000000000050', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Enums$seed$, $seed$```py
from enum import Enum

Color = Enum('Color', ['RED', 'GREEN', 'BLUE'])
print(Color.RED)  # this works, prints 'Color.RED'
print(Color.TEAL) # this raises an exception


Doctype = Enum('Doctype', ['PDF', 'TXT', 'DOCX', 'MD', 'HTML'])

```

1. A "Color" can only be RED, GREEN, or BLUE. If you try to use Color.TEAL, Python raises an exception.
2. There is a central place to see the "valid" values for a Color.
3. Each "Color" has a "name" (e.g. Color.RED) and a "value" (e.g. 1). The value is an integer and is used under the hood instead of the name. Integers take up less memory than strings, which helps with performance.

Python does not enforce your types before your code runs. That's why we need this line here to raise an Exception if a color is invalid:

```python
def color_to_hex(color):
    if color == Color.GREEN:
        return '#00FF00'
    elif color == Color.BLUE:
        return '#0000FF'
    elif color == Color.RED:
        return '#FF0000'
    # handle the case where the color is invalid
    raise Exception('unknown color')
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 50),
  ('0a7e0000-0000-4000-8000-000000000051', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$Match$seed$, $seed$```py
Color = Enum("Color", ["RED", "GREEN", "BLUE"])

def get_hex(color):
    match color:
        case Color.RED:
            return "#FF0000"
        case Color.GREEN:
            return "#00FF00"
        case Color.BLUE:
            return "#0000FF"

        # default case
        # (invalid Color)
        case _:
            return "#FFFFFF"
```

Matching two values using a tuple

```py
def get_hex(color, shade):
    match (color, shade):
        case (Color.RED, Shade.LIGHT):
            return "#FFAAAA"
        case (Color.RED, Shade.DARK):
            return "#AA0000"
        case (Color.GREEN, Shade.LIGHT):
            return "#AAFFAA"
        case (Color.GREEN, Shade.DARK):
            return "#00AA00"
        case (Color.BLUE, Shade.LIGHT):
            return "#AAAAFF"
        case (Color.BLUE, Shade.DARK):
            return "#0000AA"

        # default case
        # (invalid combination)
        case _:
            return "#FFFFFF"
```

Witch class

```py
from enum import Enum

class DocFormat(Enum):
    PDF = 1
    TXT = 2
    MD = 3
    HTML = 4

def convert_format(content, from_format, to_format):
    match (from_format, to_format):
        case(DocFormat.MD, DocFormat.HTML):
                return content.replace('# ','<h1>') + '</h1>'
        case(DocFormat.TXT, DocFormat.PDF):
                return '[PDF] ' + content  + ' [PDF]'
        case(DocFormat.HTML, DocFormat.MD):
            return content.replace('<h1>', '# ').replace('</h1>', '')
        case _:
            raise Exception('invalid type')
```

Equivalent of switch in js$seed$, '5b1ec700-0000-4000-8000-000000000001', 51),
  ('0a7e0000-0000-4000-8000-000000000052', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $seed$list.extend()$seed$, $seed$Add elements to the list

```py
list1 = [1, 2]
list1.extend([3, 4])  # list1 is now [1, 2, 3, 4]
```$seed$, '5b1ec700-0000-4000-8000-000000000001', 52)
on conflict (id) do nothing;

insert into memory_cards (
  id, user_id, note_id, subject_id, prompt, example, code_context,
  state, stability, difficulty, elapsed_days, scheduled_days,
  learning_steps, reps, lapses, due_at, last_review
) values
  ('c4ec0000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000001', '5b1ec700-0000-4000-8000-000000000001', $seed$Czym różni się programowanie imperatywne od deklaratywnego?$seed$, $seed$Imperatywne definiuje **co** i **jak** ma się wydarzyć (krok po kroku). Deklaratywne skupia się tylko na **co** chcemy osiągnąć, ukrywając implementację.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000001', '5b1ec700-0000-4000-8000-000000000001', $seed$Na czym polega programowanie funkcyjne?$seed$, $seed$Na tworzeniu funkcji zamiast mutowania stanu. Głównym celem jest uczynienie kodu bardziej deklaratywnym - przekształcamy dane zamiast zmieniać zmienne.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '3 days', now() - interval '6 days'),
  ('c4ec0000-0000-4000-8000-000000000003', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000001', '5b1ec700-0000-4000-8000-000000000001', $seed$Podaj przykład imperatywnego i deklaratywnego podejścia do sumowania listy w Pythonie.$seed$, $seed$Imperatywne: pętla `for` z akumulatorem `total += num`. Deklaratywne: `return sum(nums) / len(nums)` - nie śledzimy stanu, interesuje nas tylko wynik.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000004', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000001', '5b1ec700-0000-4000-8000-000000000001', $seed$Dlaczego CSS jest dobrym przykładem programowania deklaratywnego?$seed$, $seed$Bo opisujemy **co** chcemy osiągnąć (np. `button { color: red; }`), a nie **jak** przeglądarka ma to zrealizować krok po kroku.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '25 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000005', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000004', '5b1ec700-0000-4000-8000-000000000001', $seed$Dlaczego niemutowalność oznacza mniej bugów?$seed$, $seed$Gdy zmienna jest niemutowalna, mamy pewność, że nie zmieniła się od momentu utworzenia. Nie musimy sprawdzać, która z 10 funkcji mogła ją zmodyfikować.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000006', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000004', '5b1ec700-0000-4000-8000-000000000001', $seed$Czym różnią się `tuple` od `list` w kontekście mutowalności?$seed$, $seed$`tuple` jest niemutowalna - nie można do niej dodać elementu. `list` jest mutowalna. Aby "dodać" element do tuple, trzeba stworzyć nową kopię z dodaną wartością.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000007', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000004', '5b1ec700-0000-4000-8000-000000000001', $seed$Jak utworzyć jednoelementową tuple w Pythonie?$seed$, $seed$Trzeba dodać przecinek po elemencie: `more_ages = (80,)`. Bez przecinka Python potraktuje to jako zwykłą wartość w nawiasach.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '2 days', now() - interval '5 days'),
  ('c4ec0000-0000-4000-8000-000000000008', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000004', '5b1ec700-0000-4000-8000-000000000001', $seed$Jak "dodać" element do tuple, skoro jest niemutowalna?$seed$, $seed$Tworząc nową tuple przez konkatenację:
```py
ages = (16, 21, 30)
all_ages = ages + (80,)
# (16, 21, 30, 80)
```$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000009', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000020', '5b1ec700-0000-4000-8000-000000000001', $seed$Jakie dwa warunki musi spełnić pure function?$seed$, $seed$1) Zawsze zwraca ten sam wynik dla tych samych argumentów. 2) Nie powoduje żadnych side effects.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '30 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000010', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000020', '5b1ec700-0000-4000-8000-000000000001', $seed$Dlaczego poniższa funkcja jest impure?
```py
total = 0
def dirty_add(x):
    global total
    total = total + x
    return total
```$seed$, $seed$Bo modyfikuje zmienną globalną `total` (side effect) i zwraca różne wyniki dla tego samego argumentu - `dirty_add(10)` da kolejno 10, 20, 30.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000011', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000020', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest referential transparency?$seed$, $seed$Właściwość pure functions - można je zastąpić ich wartością zwracaną bez zmiany zachowania programu. Np. `add(2, 3)` zawsze można zastąpić liczbą `5`.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000012', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000020', '5b1ec700-0000-4000-8000-000000000001', $seed$Dlaczego mimo zalet pure functions czasem potrzebujemy impure functions?$seed$, $seed$Bo potrzebujemy side effects - program bez nich byłby bezużyteczny. Zapis do bazy, wyświetlenie wyniku, request HTTP - to wszystko wymaga side effects.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '1 days', now() - interval '4 days'),
  ('c4ec0000-0000-4000-8000-000000000013', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000021', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest side effect w kontekście funkcji?$seed$, $seed$Wszystko, co funkcja robi oprócz zwracania wartości.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000014', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000021', '5b1ec700-0000-4000-8000-000000000001', $seed$Wymień co najmniej 5 przykładów side effects.$seed$, $seed$Wypisywanie do konsoli, zapis/odczyt z bazy danych, dostęp do internetu, modyfikacja zmiennych globalnych, modyfikacja argumentów wejściowych, zapis do pliku, operacje I/O.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '21 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000015', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000021', '5b1ec700-0000-4000-8000-000000000001', $seed$Co oznacza I/O w programowaniu i jaki ma związek z side effects?$seed$, $seed$I/O to input/output - wszystko co wchodzi w interakcję ze "światem zewnętrznym" (poza pamięcią aplikacji). Każda operacja I/O jest formą side effect, łącznie z `print()`.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000016', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000021', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest No-Op i co sugeruje o funkcji?$seed$, $seed$No-Op to operacja, która nic nie robi. Jeśli funkcja nic nie zwraca, prawdopodobnie jest impure i wykonuje side effects.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000017', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000011', '5b1ec700-0000-4000-8000-000000000001', $seed$Co oznacza, że Python ma first-class functions?$seed$, $seed$Że funkcje mogą być traktowane jak każdy inny obiekt - przypisane do zmiennej, przekazane jako argument, zwrócone z funkcji i przechowywane w strukturach danych.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '6 days', now() - interval '9 days'),
  ('c4ec0000-0000-4000-8000-000000000018', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000011', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż jak przypisać funkcję do zmiennej w Pythonie.$seed$, $seed$```py
def foo(a, b):
    return a + b

sum_foo = foo
print(sum_foo(2, 2))  # 4
```
Przypisujemy referencję do funkcji (bez nawiasów) do nowej zmiennej.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000019', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000012', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest lambda w Pythonie i czym odpowiada w JavaScript?$seed$, $seed$Lambda to anonimowa (nienazwana) funkcja. Odpowiada arrow function w JS: `lambda x: x + 1` to ekwiwalent `(x) => x + 1`.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '26 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000020', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000012', '5b1ec700-0000-4000-8000-000000000001', $seed$Jakie jest kluczowe ograniczenie lambda w Pythonie?$seed$, $seed$Lambda może zawierać tylko jedno wyrażenie (single expression). Nie można w niej np. najpierw wywołać `print()`, a potem zwrócić wartość - w przeciwieństwie do callbacka w JS.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000021', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000012', '5b1ec700-0000-4000-8000-000000000001', $seed$Jaka jest składnia lambda w Pythonie?$seed$, $seed$```py
lambda argumenty: wyrażenie
# np.
lambda x, y: x + y
```
Wynik wyrażenia jest zwracany automatycznie.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000022', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000013', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest higher-order function?$seed$, $seed$Funkcja, która przyjmuje inną funkcję jako argument lub zwraca funkcję.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '5 days', now() - interval '8 days'),
  ('c4ec0000-0000-4000-8000-000000000023', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000013', '5b1ec700-0000-4000-8000-000000000001', $seed$Jakie trzy wbudowane higher-order functions w Pythonie są najczęściej używane?$seed$, $seed$`map()`, `filter()` i `functools.reduce()`.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000024', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000013', '5b1ec700-0000-4000-8000-000000000001', $seed$Dlaczego `print(map(square, [1, 2, 3]))` nie wypisuje listy wyników?$seed$, $seed$Bo `map()` zwraca obiekt typu `map`, a nie listę. Trzeba go przekonwertować: `list(map(square, [1, 2, 3]))`.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '31 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000025', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000013', '5b1ec700-0000-4000-8000-000000000001', $seed$Jaka jest składnia `filter()` i co zwraca?$seed$, $seed$```py
evens = list(filter(lambda x: x % 2 == 0, numbers))
```
Przyjmuje funkcję zwracającą `bool` i iterable. Zwraca obiekt filter (trzeba owinąć w `list()`).$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000026', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000013', '5b1ec700-0000-4000-8000-000000000001', $seed$Czym `functools.reduce()` różni się od `map()` i `filter()`?$seed$, $seed$`reduce()` trzeba zaimportować z modułu `functools`. Przyjmuje funkcję z dwoma argumentami (akumulator i bieżący element) i redukuje iterable do jednej wartości.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000027', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000013', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż użycie `reduce()` z lambdą.$seed$, $seed$```py
import functools
total = functools.reduce(lambda a, b: a + b, [1, 2, 3, 4])
# 10
```$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '4 days', now() - interval '7 days'),
  ('c4ec0000-0000-4000-8000-000000000028', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000013', '5b1ec700-0000-4000-8000-000000000001', $seed$Co robi funkcja `zip()` i co zwraca?$seed$, $seed$Łączy dwa iterables w nowy iterable, gdzie każdy element to tuple z jednym elementem z każdego źródła. Zwraca obiekt `zip` (trzeba owinąć w `list()`).$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000029', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000013', '5b1ec700-0000-4000-8000-000000000001', $seed$Co się stanie, gdy przekażemy do `zip()` iterables o różnej długości?$seed$, $seed$Zwróci tylko tyle par, ile pozwala krótszy iterable. Nadmiarowe elementy z dłuższego są ignorowane.
```py
list(zip([1, 2, 3, 4, 5], [1, 2, 3]))
# [(1, 1), (2, 2), (3, 3)]
```$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '22 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000030', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000037', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest closure?$seed$, $seed$Funkcja, która "pamięta" zmienne z otaczającego zakresu (enclosing scope), nawet po zakończeniu wykonania tego zakresu. Closure jest z natury stanowa (stateful).$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000031', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000037', '5b1ec700-0000-4000-8000-000000000001', $seed$Kiedy potrzebujemy słowa kluczowego `nonlocal` w closure?$seed$, $seed$Gdy chcemy **reasignować** (ponownie przypisać) zmienną niemutowalną z otaczającego zakresu (np. string, int). Przy modyfikacji mutowalnego obiektu (np. `list.append()`) `nonlocal` nie jest potrzebny.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000032', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000037', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż przykład closure, który nie wymaga `nonlocal`.$seed$, $seed$```py
def new_collection(initial_docs):
    init_copy = initial_docs.copy()
    def foo(str):
        init_copy.append(str)  # modyfikujemy mutowalny obiekt
        return init_copy
    return foo
```
Lista jest mutowalna, więc `.append()` działa bez `nonlocal`.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '3 days', now() - interval '6 days'),
  ('c4ec0000-0000-4000-8000-000000000033', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000037', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż przykład closure, który wymaga `nonlocal`.$seed$, $seed$```py
def concatter():
    doc = ""
    def doc_builder(word):
        nonlocal doc  # wymagane - reasignujemy string
        doc += word + " "
        return doc
    return doc_builder
```
String jest niemutowalny, więc `doc += ...` to reasignacja.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000034', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000036', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest function transformation?$seed$, $seed$Specyficzny typ higher-order function - funkcja, która przyjmuje inną funkcję jako argument **i zwraca nową funkcję**.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '27 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000035', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000036', '5b1ec700-0000-4000-8000-000000000001', $seed$Dlaczego function transformations są przydatne?$seed$, $seed$Pozwalają współdzielić funkcjonalność. Zamiast tworzyć wiele oddzielnych funkcji, tworzymy jedną transformację, która generuje wyspecjalizowane warianty.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000036', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000036', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż przykład function transformation tworzącego wyspecjalizowane funkcje.$seed$, $seed$```py
def self_math(math_func):
    def inner_func(x):
        return math_func(x, x)
    return inner_func

square_func = self_math(multiply)  # 5 -> 25
double_func = self_math(add)       # 5 -> 10
```$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000037', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000039', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest currying?$seed$, $seed$Transformacja funkcji wieloargumentowej w łańcuch funkcji jednoargumentowych. `sum(a, b)` staje się `sum(a)(b)`.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '2 days', now() - interval '5 days'),
  ('c4ec0000-0000-4000-8000-000000000038', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000039', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż currying w Pythonie.$seed$, $seed$```py
def sum(a):
    def inner_sum(b):
        return a + b
    return inner_sum

print(sum(1)(2))  # 3
```$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000039', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000039', '5b1ec700-0000-4000-8000-000000000001', $seed$Kiedy currying jest przydatny?$seed$, $seed$Gdy trzeba dostosować sygnaturę funkcji do wymagań zewnętrznego narzędzia. Np. gdy API oczekuje funkcji jednoargumentowej, a nasza ma dwa argumenty - currying pozwala "wpiąć" pierwszy argument i zwrócić jednoargumentową wersję.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '32 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000040', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000047', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest decorator w Pythonie?$seed$, $seed$Syntactic sugar wokół function transformations. Upraszcza zapis wyższego rzędu funkcji, która przyjmuje funkcję i zwraca nową funkcję.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000041', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000047', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż równoważne zapisy z i bez decoratora.$seed$, $seed$```py
# Bez decoratora:
def myFoo(val):
    print(val)
tt = vowel_counter(myFoo)

# Z decoratorem (równoważne):
@vowel_counter
def myFoo(val):
    print(val)
```$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000042', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000047', '5b1ec700-0000-4000-8000-000000000001', $seed$W jakiej kolejności wykonują się stacked decorators?$seed$, $seed$Od dołu do góry. Najpierw stosowany jest dekorator najbliżej funkcji, potem kolejne w górę.
```py
@to_uppercase       # 2. owijamy wynik get_truncate
@get_truncate(9)    # 1. najpierw owijamy print_input
def print_input(input):
    print(input)
```$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '1 days', now() - interval '4 days'),
  ('c4ec0000-0000-4000-8000-000000000043', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000047', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest `lru_cache` i do czego służy?$seed$, $seed$Dekorator z `functools`, który memoizuje wyniki funkcji. Cachuje pary input-output w słowniku o ograniczonym rozmiarze - przyspiesza powtarzające się wywołania z tymi samymi argumentami.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000044', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000047', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż użycie `lru_cache`.$seed$, $seed$```py
from functools import lru_cache

@lru_cache()
def factorial_r(x):
    if x == 0:
        return 1
    return x * factorial_r(x - 1)
```
Kolejne wywołania z tymi samymi argumentami korzystają z cache.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '23 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000045', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000019', '5b1ec700-0000-4000-8000-000000000001', $seed$Jak działa parametr `key` w `sorted()`?$seed$, $seed$Przyjmuje funkcję, która jest wywoływana na każdym elemencie, tworząc tymczasowy "klucz sortowania". Elementy są sortowane wg kluczy, ale zwracane są oryginalne wartości.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000046', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000019', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż sortowanie dat za pomocą `sorted()` z `key`.$seed$, $seed$```py
def transform_date(date_str):
    month, day, year = date_str.split("-")
    return year + month + day

sorted(dates, key=transform_date)
```
Daty w formacie "MM-DD-YYYY" są sortowane chronologicznie.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000047', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000019', '5b1ec700-0000-4000-8000-000000000001', $seed$Czym różni się `sort()` od `sorted()`?$seed$, $seed$`list.sort()` mutuje oryginalną listę (in-place). `sorted()` zwraca nową posortowaną listę, nie zmieniając oryginału.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '6 days', now() - interval '9 days'),
  ('c4ec0000-0000-4000-8000-000000000048', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000024', '5b1ec700-0000-4000-8000-000000000001', $seed$Czym różni się `copy()` od `copy.deepcopy()`?$seed$, $seed$`.copy()` tworzy płytką kopię (shallow copy) - zagnieżdżone obiekty nadal są referencjami. `copy.deepcopy()` tworzy głęboką kopię - kopiuje rekurencyjnie wszystkie zagnieżdżone obiekty.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000049', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000024', '5b1ec700-0000-4000-8000-000000000001', $seed$Co się stanie, jeśli zrobimy `new_list = old_list` zamiast `new_list = old_list.copy()`?$seed$, $seed$`new_list` będzie referencją do tego samego obiektu - zmiany w jednej zmiennej będą widoczne w drugiej.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '28 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000050', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000022', '5b1ec700-0000-4000-8000-000000000001', $seed$Które typy w Pythonie są przekazywane przez referencję, a które przez wartość?$seed$, $seed$Przez referencję: `list`, `dict`, `set` (mutowalne). Przez wartość: `int`, `float`, `str`, `bool`, `tuple` (niemutowalne).$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000051', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000022', '5b1ec700-0000-4000-8000-000000000001', $seed$Co się stanie, gdy zmodyfikujemy listę przekazaną do funkcji?$seed$, $seed$```py
def modify_list(inner_lst):
    inner_lst.append(4)

outer_lst = [1, 2, 3]
modify_list(outer_lst)
# outer_lst = [1, 2, 3, 4] - oryginał zmieniony!
```
Lista jest przekazywana przez referencję - modyfikacja wewnątrz funkcji zmienia oryginał.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000052', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000020', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest memoization?$seed$, $seed$Cachowanie (przechowywanie) wyników obliczeń, aby nie trzeba było ich powtarzać dla tych samych danych wejściowych.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '5 days', now() - interval '8 days'),
  ('c4ec0000-0000-4000-8000-000000000053', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000020', '5b1ec700-0000-4000-8000-000000000001', $seed$Dlaczego pure functions mogą być bezpiecznie memoizowane, a impure nie?$seed$, $seed$Bo pure functions zawsze zwracają ten sam wynik dla tych samych argumentów. Impure functions mogą zwracać różne wyniki - cache dawałby błędne odpowiedzi.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000054', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000020', '5b1ec700-0000-4000-8000-000000000001', $seed$Jaki jest trade-off przy memoization?$seed$, $seed$Szybkość vs pamięć RAM. Memoization przyspiesza obliczenia kosztem zużycia pamięci na cache. Jeśli funkcja jest wystarczająco szybka, memoization może nie być opłacalna.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '33 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000055', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000041', '5b1ec700-0000-4000-8000-000000000001', $seed$Co robią `*args` i `**kwargs`?$seed$, $seed$`*args` zbiera argumenty pozycyjne do tuple (kolejność ma znaczenie). `**kwargs` zbiera argumenty nazwane (keyword) do słownika.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000056', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000041', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż różnicę między argumentami pozycyjnymi a keyword.$seed$, $seed$```py
def sub(a, b):
    return a - b

sub(3, 2)       # pozycyjne: a=3, b=2, wynik=1
sub(b=3, a=2)   # keyword: a=2, b=3, wynik=-1
```$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000057', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000041', '5b1ec700-0000-4000-8000-000000000001', $seed$Jaka jest zasada kolejności argumentów pozycyjnych i keyword?$seed$, $seed$Argumenty pozycyjne muszą być **przed** keyword. `sub(b=3, 2)` spowoduje błąd.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '4 days', now() - interval '7 days'),
  ('c4ec0000-0000-4000-8000-000000000058', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000041', '5b1ec700-0000-4000-8000-000000000001', $seed$Co robi `**` przy rozpakowaniu słownika?$seed$, $seed$Konwertuje klucze słownika na keyword arguments:
```py
my_dict = {"name": "Konrad", "age": 38}
greet(**my_dict)  # = greet(name="Konrad", age=38)
```
Funkcja musi przyjmować parametry o takich samych nazwach jak klucze.$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000059', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000042', '5b1ec700-0000-4000-8000-000000000001', $seed$Do czego służy `enumerate()` i dlaczego jest lepszy od `range(len())`?$seed$, $seed$Daje dostęp do indeksu i elementu jednocześnie podczas iteracji. Jest lepszy od `range(len())`, bo nie wymaga ręcznego indeksowania, jest czytelniejszy i bezpieczniejszy.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '24 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000060', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000042', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż składnię `enumerate()`.$seed$, $seed$```py
for index, item in enumerate(args):
    print(f"{index + 1}. {item}")
```$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000061', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000002', '5b1ec700-0000-4000-8000-000000000001', $seed$Do czego służy `Enum` w Pythonie?$seed$, $seed$Definiuje zamknięty zbiór dopuszczalnych wartości. Zapewnia centralne miejsce z listą prawidłowych wartości i rzuca wyjątek przy próbie użycia nieprawidłowej.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000062', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000002', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż dwa sposoby tworzenia Enum w Pythonie.$seed$, $seed$```py
# Sposób 1 - funkcja:
Color = Enum('Color', ['RED', 'GREEN', 'BLUE'])

# Sposób 2 - klasa:
class DocFormat(Enum):
    PDF = 1
    TXT = 2
    MD = 3
```$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '3 days', now() - interval '6 days'),
  ('c4ec0000-0000-4000-8000-000000000063', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000044', '5b1ec700-0000-4000-8000-000000000001', $seed$Czym jest `match` w Pythonie i co odpowiada mu w JavaScript?$seed$, $seed$`match` to odpowiednik `switch` z JS. Porównuje wartość z wieloma wzorcami i wykonuje kod dla pierwszego dopasowania. `case _:` to domyślny przypadek (jak `default`).$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000064', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000044', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż `match` z dopasowywaniem tuple.$seed$, $seed$```py
match (color, shade):
    case (Color.RED, Shade.LIGHT):
        return "#FFAAAA"
    case (Color.RED, Shade.DARK):
        return "#AA0000"
    case _:
        return "#FFFFFF"
```
Pozwala dopasowywać kombinacje wielu wartości jednocześnie.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '29 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000065', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000009', '5b1ec700-0000-4000-8000-000000000001', $seed$Czym różnią się statements od expressions?$seed$, $seed$Statements to akcje do wykonania (np. `n = 7`, `if x > 10`). Expressions to podzbiór statements, który **produkuje wartości** (np. `2 + 2`, `len("hello")`).$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),
  ('c4ec0000-0000-4000-8000-000000000066', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000009', '5b1ec700-0000-4000-8000-000000000001', $seed$Dlaczego w programowaniu funkcyjnym preferujemy expressions?$seed$, $seed$Bo expressions produkują wartości, są reusable, deklaratywne, nie mutują stanu i minimalizują side effects.$seed$, null,
   1, 1.2, 5, 0, 0, 0, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('c4ec0000-0000-4000-8000-000000000067', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000009', '5b1ec700-0000-4000-8000-000000000001', $seed$Pokaż ternary expression w Pythonie i wyjaśnij, dlaczego jest lepszy od if/else.$seed$, $seed$```py
# Statement (mutuje result):
result = 0
if number % 2 == 0:
    result = number / 2
else:
    result = (number * 3) + 1

# Expression (brak mutacji):
result = number / 2 if number % 2 == 0 else (number * 3) + 1
```
Expression unika mutowania zmiennej `result`.$seed$, null,
   2, 8, 5.5, 0, 4, 0, 3, 0, now() - interval '2 days', now() - interval '5 days'),
  ('c4ec0000-0000-4000-8000-000000000068', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000032', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest rekurencja i dlaczego jest ważna w programowaniu funkcyjnym?$seed$, $seed$Funkcja wywołująca samą siebie. W FP jest ważna, bo pozwala uniknąć pętli ze stanowymi zmiennymi (akumulatorami).$seed$, null,
   2, 4, 6, 0, 2, 0, 2, 0, now(), now() - interval '2 days'),
  ('c4ec0000-0000-4000-8000-000000000069', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000032', '5b1ec700-0000-4000-8000-000000000001', $seed$Co to jest base case i co się stanie bez niego?$seed$, $seed$Base case to warunek kończący rekurencję. Bez niego funkcja będzie się wywoływać w nieskończoność, co doprowadzi do stack overflow.$seed$, null,
   2, 45, 4, 0, 35, 0, 5, 0, now() + interval '34 days', now() - interval '10 days'),
  ('c4ec0000-0000-4000-8000-000000000070', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '0a7e0000-0000-4000-8000-000000000032', '5b1ec700-0000-4000-8000-000000000001', $seed$Kiedy rekurencja jest lepsza od pętli?$seed$, $seed$Przy strukturach "drzewiastych" o nieznanej głębokości - zagnieżdżone słowniki, systemy plików, HTML, JSON. Dla jednowymiarowych list prosta pętla jest zazwyczaj lepsza.$seed$, null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null)
on conflict (id) do nothing;

-- Review history (~53 weeks) for the dashboard heatmap, streak, and retention stats.
insert into review_events (id, user_id, memory_card_id, rating, reviewed_at)
with cards as (
  select id, (row_number() over (order by id) - 1) as rn, count(*) over () as total
  from memory_cards where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
),
day_n as (
  select g.d, case
    when g.d < 12 then 5 + ((('x' || substr(md5('goal' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 % 8)
    when (('x' || substr(md5('act' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 < 30 then 0
    when (('x' || substr(md5('act' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 < 60 then 1 + ((('x' || substr(md5('lvl' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 % 5)
    when (('x' || substr(md5('act' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 < 82 then 6 + ((('x' || substr(md5('lvl' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 % 5)
    when (('x' || substr(md5('act' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 < 95 then 11 + ((('x' || substr(md5('lvl' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 % 5)
    else 16 + ((('x' || substr(md5('lvl' || g.d::text), 1, 8))::bit(32)::int % 100 + 100) % 100 % 8)
  end as n
  from generate_series(0, 370) as g(d)
)
select
  md5('rev-' || dn.d::text || '-' || c.rn::text)::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  c.id,
  (case
    when (('x' || substr(md5('rate' || dn.d::text || '-' || c.rn::text), 1, 8))::bit(32)::int % 100 + 100) % 100 < 8 then 1
    when (('x' || substr(md5('rate' || dn.d::text || '-' || c.rn::text), 1, 8))::bit(32)::int % 100 + 100) % 100 < 22 then 2
    when (('x' || substr(md5('rate' || dn.d::text || '-' || c.rn::text), 1, 8))::bit(32)::int % 100 + 100) % 100 < 80 then 3
    else 4 end)::smallint,
  date_trunc('day', now()) - (dn.d || ' days')::interval
    + interval '12 hours' + (((('x' || substr(md5('min' || dn.d::text || '-' || c.rn::text), 1, 8))::bit(32)::int % 100 + 100) % 100 * 2) || ' minutes')::interval
from day_n dn
join cards c on ((c.rn + dn.d * 7) % c.total) < least(dn.n, c.total)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Backfill each linked card's own subject_id from its source note. The DB
-- trigger that once did this was dropped (standalone-memory-cards): the app
-- owns subject_id now, so the seed seeds it explicitly here. Generator-
-- independent and idempotent (only fills nulls), so it covers the hand-written
-- dev block (whose note has no subject -> stays null) and the generated
-- test@gmail.com block (note subject 5b1ec700… -> set) alike.
-- ----------------------------------------------------------------------------
update memory_cards mc
set subject_id = n.subject_id
from notes n
where mc.note_id = n.id and mc.subject_id is null;
