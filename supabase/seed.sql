alter table public.services add column if not exists distance_km numeric not null default 0;
alter table public.services add column if not exists rating numeric(2,1) not null default 0;
alter table public.services add column if not exists address text not null default '';
alter table public.services add column if not exists latitude numeric not null default 0;
alter table public.services add column if not exists longitude numeric not null default 0;
alter table public.services add column if not exists open boolean not null default false;
alter table public.services add column if not exists image_url text not null default '';

insert into public.users (id, full_name, phone, country, onboarded, pets, subscriptions, pet_ids, member_since, vet_sure_member) values
('00000000-0000-4000-8000-000000000021','Chipo Moyo','+263 77 123 4567','Zimbabwe',true,2,'[{"plan":"VetSure Premium","status":"Active","renews":"12 Sep 2026"},{"plan":"Emergency Cover","status":"Active","renews":"28 Aug 2026"}]','["00000000-0000-4000-8000-000000000031","00000000-0000-4000-8000-000000000032"]','March 2024',true),
('00000000-0000-4000-8000-000000000022','Tendai Ndlovu','+263 77 234 5678','Zimbabwe',true,1,'[{"plan":"Basic Care","status":"Active","renews":"05 Oct 2026"}]','["00000000-0000-4000-8000-000000000031"]','January 2025',false),
('00000000-0000-4000-8000-000000000023','Samuel Banda','+263 77 345 6789','Zimbabwe',false,0,'[{"plan":"No active plan","status":"Paused","renews":"-"}]','[]','New member',false),
('00000000-0000-4000-8000-000000000024','Tariro Chikafu','+263 77 456 7890','Zimbabwe',true,3,'[{"plan":"VetSure Family","status":"Active","renews":"19 Nov 2026"}]','["00000000-0000-4000-8000-000000000032"]','August 2023',true)
on conflict (id) do update set full_name=excluded.full_name, phone=excluded.phone, country=excluded.country, onboarded=excluded.onboarded, pets=excluded.pets, subscriptions=excluded.subscriptions, pet_ids=excluded.pet_ids, member_since=excluded.member_since, vet_sure_member=excluded.vet_sure_member;

insert into public.vets (id,name,surgery,location,phone,status,rating) values
('00000000-0000-4000-8000-000000000041','Dr Munzeiwa','Animal Farm','Harare Central','+263 77 765 4321','Active',4.9),
('00000000-0000-4000-8000-000000000042','Dr Tendai Mashiri','Greenfields Vet Clinic','Bulawayo','+263 77 987 6543','Active',4.7),
('00000000-0000-4000-8000-000000000043','Dr Kudzai Nyashanu','Kariba Animal Care','Kariba','+263 77 555 0101','Inactive',4.2)
on conflict (id) do update set name=excluded.name, surgery=excluded.surgery, location=excluded.location, phone=excluded.phone, status=excluded.status, rating=excluded.rating;

insert into public.services (id,name,category,distance_km,rating,address,latitude,longitude,open,image_url) values
('00000000-0000-4000-8000-000000000001','Animal Farm','Veterinary Clinic',0.8,4.9,'12 Whitwell Road, Borrowdale',-17.7845,31.0443,true,''),
('00000000-0000-4000-8000-000000000002','The Grooming Studio','Grooming',1.2,4.7,'5 Arundel Village, Harare',-17.8355,31.045,true,''),
('00000000-0000-4000-8000-000000000003','PetLife Supplies','Pet Store',1.5,4.5,'Sam Levy''s Village, Harare',-17.8153,31.0406,false,''),
('00000000-0000-4000-8000-000000000004','24/7 Animal Emergency Centre','Emergency',2.1,4.8,'88 Enterprise Road, Harare',-17.8201,31.0302,true,'')
on conflict (id) do update set name=excluded.name, category=excluded.category, distance_km=excluded.distance_km, rating=excluded.rating, address=excluded.address, latitude=excluded.latitude, longitude=excluded.longitude, open=excluded.open, image_url=excluded.image_url;

insert into public.community_posts (id,author,location,time_ago,avatar_url,image_url,body,likes,comments,tag) values
('00000000-0000-4000-8000-000000000011','Tariro M.','Harare','2h ago','','','Bruno had a great time at the park today. Regular walks keep him healthy and happy.',24,6,'Story'),
('00000000-0000-4000-8000-000000000012','Dr Munzeiwa','Animal Farm','5h ago','','','Cats hide pain well. Watch for reduced grooming, hiding, and appetite changes - these are early signs worth a check-up.',148,21,'Education'),
('00000000-0000-4000-8000-000000000013','Paws Rescue ZW','Bulawayo','1d ago','','','Three rescued puppies are now fully vaccinated and ready for loving homes. Reach out if you can help.',312,47,'Rescue')
on conflict (id) do update set author=excluded.author, location=excluded.location, time_ago=excluded.time_ago, body=excluded.body, likes=excluded.likes, comments=excluded.comments, tag=excluded.tag;

insert into public.pets (id,vetconnect_id,name,species,breed,sex,age_years,colour,microchip,photo_url,health_status,weight_kg,next_vaccine,medication_today,vet_sure,timeline) values
('00000000-0000-4000-8000-000000000031','VC-ZW-284915','Buddy','Dog','Golden Retriever','Male',3,'Golden','985141002374561','','Healthy',31.4,'12 August','None Today',false,'[{"id":"e0","date":"02 July 2026","title":"Annual check-up","detail":"All vitals normal. Weight stable.","type":"checkup"},{"id":"e2","date":"18 May 2026","title":"Rabies vaccination","detail":"Administered by Dr Munzeiwa.","type":"vaccine"}]'),
('00000000-0000-4000-8000-000000000032','VC-ZW-771043','Mia','Cat','Domestic Shorthair','Female',2,'Tabby',null,'','Attention',4.2,'30 September','Eye drops',false,'[{"id":"e5","date":"11 July 2026","title":"Eye irritation review","detail":"Prescribed drops for 7 days","type":"treatment"},{"id":"e6","date":"02 February 2026","title":"Feline core vaccine","detail":"First annual booster.","type":"vaccine"}]')
on conflict (id) do update set vetconnect_id=excluded.vetconnect_id, name=excluded.name, species=excluded.species, breed=excluded.breed, sex=excluded.sex, age_years=excluded.age_years, colour=excluded.colour, microchip=excluded.microchip, photo_url=excluded.photo_url, health_status=excluded.health_status, weight_kg=excluded.weight_kg, next_vaccine=excluded.next_vaccine, medication_today=excluded.medication_today, vet_sure=excluded.vet_sure, timeline=excluded.timeline;
