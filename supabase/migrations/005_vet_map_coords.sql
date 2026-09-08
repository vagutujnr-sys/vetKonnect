-- Seed / refresh coordinates for closest-vet map search

update public.vets set
  latitude = -17.7845,
  longitude = 31.0443,
  address = coalesce(nullif(address, ''), '12 Whitwell Road, Borrowdale, Harare')
where id = '00000000-0000-4000-8000-000000000041';

update public.vets set
  latitude = -20.1563,
  longitude = 28.5887,
  address = coalesce(nullif(address, ''), 'Greenfields, Bulawayo')
where id = '00000000-0000-4000-8000-000000000042';

update public.vets set
  latitude = -16.5167,
  longitude = 28.8,
  address = coalesce(nullif(address, ''), 'Kariba Animal Care, Kariba')
where id = '00000000-0000-4000-8000-000000000043';

insert into public.vets (id, name, surgery, location, phone, status, rating, latitude, longitude, address)
values
  ('00000000-0000-4000-8000-000000000044', 'Dr Nyasha Moyo', 'Avondale Pet Hospital', 'Avondale', '+263 77 111 2233', 'Active', 4.6, -17.7988, 31.0294, 'King George Road, Avondale, Harare'),
  ('00000000-0000-4000-8000-000000000045', 'Dr Farai Chirwa', 'Mount Pleasant Vet', 'Mount Pleasant', '+263 77 222 3344', 'Active', 4.8, -17.7752, 31.0601, 'The Chase, Mount Pleasant, Harare'),
  ('00000000-0000-4000-8000-000000000046', 'Dr Rutendo Sibanda', 'CBD Animal Clinic', 'Harare Central', '+263 77 333 4455', 'Active', 4.5, -17.8252, 31.0335, 'Jason Moyo Avenue, Harare CBD'),
  ('00000000-0000-4000-8000-000000000047', 'Dr Tinashe Gumbo', 'Eastlea Vetcare', 'Eastlea', '+263 77 444 5566', 'Active', 4.4, -17.8308, 31.0784, 'St Patrick Road, Eastlea, Harare')
on conflict (id) do update set
  name = excluded.name,
  surgery = excluded.surgery,
  location = excluded.location,
  phone = excluded.phone,
  status = excluded.status,
  rating = excluded.rating,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  address = excluded.address;

notify pgrst, 'reload schema';
