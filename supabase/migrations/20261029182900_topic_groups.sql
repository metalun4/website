-- Topic groups, aliases, and cross-exam topic statistics.
-- Additive and idempotent. Safe when topic_groups and topics.group_id already exist.
-- Does not change existing topics.group_id values or exam question rows.
-- Do not rerun 20261028135230_tyt_pdf_import.sql.
begin;

create table if not exists public.topic_groups (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id),
  name text not null,
  normalized_name text not null,
  display_order smallint not null
);

do $$ begin
  alter table public.topic_groups add constraint topic_groups_name_check check (length(btrim(name)) between 1 and 300);
exception when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.topic_groups add constraint topic_groups_check check (normalized_name = public.normalize_topic_label(name));
exception when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.topic_groups add constraint topic_groups_display_order_check check (display_order > 0);
exception when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.topic_groups add constraint topic_groups_subject_id_normalized_name_key unique (subject_id, normalized_name);
exception when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.topic_groups add constraint topic_groups_id_subject_id_key unique (id, subject_id);
exception when duplicate_object or duplicate_table then null;
end $$;

alter table public.topics add column if not exists group_id uuid;
create index if not exists topics_group_idx on public.topics (group_id);
do $$ begin
  alter table public.topics add constraint topics_group_subject_fk foreign key (group_id, subject_id) references public.topic_groups (id, subject_id);
exception when duplicate_object or duplicate_table then null;
end $$;

create or replace function public.check_direct_subject() returns trigger
language plpgsql set search_path='' as $$
declare s public.subjects; e_type text;
begin
 select * into strict s from public.subjects where id=new.subject_id;
 if tg_table_name in ('exam_questions','topics','topic_groups') and s.expected_questions=0 then raise exception 'DIRECT_SUBJECT_REQUIRED'; end if;
 if tg_table_name not in ('topics','topic_groups') then
  select exam_type into strict e_type from public.exams where id=new.exam_id;
  if e_type<>s.exam_type then raise exception 'SUBJECT_EXAM_TYPE'; end if;
 end if;
 return new;
end $$;
drop trigger if exists topic_group_subject_check on public.topic_groups;
create trigger topic_group_subject_check before insert or update on public.topic_groups
for each row execute function public.check_direct_subject();

alter table public.topic_groups enable row level security;
revoke all on public.topic_groups from public, anon, authenticated;
grant select, insert, update, delete on public.topic_groups to service_role;

create table if not exists public.topic_aliases (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id),
  group_id uuid not null,
  alias text not null check (length(btrim(alias)) between 1 and 300 and alias !~ '[[:cntrl:]]'),
  normalized_name text not null check (normalized_name = public.normalize_topic_label(alias)),
  created_at timestamptz not null default now(),
  unique (subject_id, normalized_name),
  foreign key (group_id, subject_id) references public.topic_groups (id, subject_id)
);
create index if not exists topic_aliases_group_idx on public.topic_aliases (group_id);

create or replace function public.check_topic_alias() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists (
    select 1 from public.topic_groups g
    where g.subject_id = new.subject_id and g.normalized_name = new.normalized_name
  ) then
    raise exception 'ALIAS_MATCHES_GROUP';
  end if;
  return new;
end $$;
drop trigger if exists topic_alias_check on public.topic_aliases;
create trigger topic_alias_check before insert or update on public.topic_aliases
for each row execute function public.check_topic_alias();

alter table public.topic_aliases enable row level security;
revoke all on public.topic_aliases from public, anon, authenticated;
grant select, insert, update, delete on public.topic_aliases to service_role;

insert into public.topic_groups (subject_id, name, normalized_name, display_order)
select v.subject_id, v.name, public.normalize_topic_label(v.name), v.display_order
from (values
  ('tyt_turkish', 'Sözcükte anlam', 1),
  ('tyt_turkish', 'Cümlede anlam', 2),
  ('tyt_turkish', 'Paragrafta anlam', 3),
  ('tyt_turkish', 'Paragrafta ana düşünce ve yardımcı düşünce', 4),
  ('tyt_turkish', 'Paragrafta yapı', 5),
  ('tyt_turkish', 'Anlatım biçimleri', 6),
  ('tyt_turkish', 'Düşünceyi geliştirme yolları', 7),
  ('tyt_turkish', 'Sözel mantık', 8),
  ('tyt_turkish', 'Ses bilgisi ve ses olayları', 9),
  ('tyt_turkish', 'Yazım kuralları', 10),
  ('tyt_turkish', 'Noktalama işaretleri', 11),
  ('tyt_turkish', 'Sözcükte yapı ve ekler', 12),
  ('tyt_turkish', 'Sözcük türleri (isim, sıfat, zamir, zarf, edat, bağlaç, ünlem)', 13),
  ('tyt_turkish', 'Fiiller ve ek fiil', 14),
  ('tyt_turkish', 'Fiilimsiler', 15),
  ('tyt_turkish', 'Fiilde çatı', 16),
  ('tyt_turkish', 'Cümlenin ögeleri', 17),
  ('tyt_turkish', 'Cümle türleri', 18),
  ('tyt_turkish', 'Anlatım bozuklukları', 19),
  ('tyt_turkish', 'Deyimler ve atasözleri', 20),
  ('tyt_math', 'Temel kavramlar', 1),
  ('tyt_math', 'Sayı kümeleri', 2),
  ('tyt_math', 'Sayı basamakları', 3),
  ('tyt_math', 'Bölme ve bölünebilme', 4),
  ('tyt_math', 'EBOB ve EKOK', 5),
  ('tyt_math', 'Rasyonel sayılar', 6),
  ('tyt_math', 'Basit eşitsizlikler', 7),
  ('tyt_math', 'Mutlak değer', 8),
  ('tyt_math', 'Üslü sayılar', 9),
  ('tyt_math', 'Köklü sayılar', 10),
  ('tyt_math', 'Çarpanlara ayırma ve özdeşlikler', 11),
  ('tyt_math', 'Oran ve orantı', 12),
  ('tyt_math', 'Birinci dereceden denklemler', 13),
  ('tyt_math', 'Sayı ve kesir problemleri', 14),
  ('tyt_math', 'Yaş problemleri', 15),
  ('tyt_math', 'Yüzde, kâr ve zarar problemleri', 16),
  ('tyt_math', 'Karışım problemleri', 17),
  ('tyt_math', 'Hareket problemleri', 18),
  ('tyt_math', 'İşçi ve havuz problemleri', 19),
  ('tyt_math', 'Tablo ve grafik problemleri', 20),
  ('tyt_math', 'Rutin olmayan problemler', 21),
  ('tyt_math', 'Kümeler', 22),
  ('tyt_math', 'Mantık', 23),
  ('tyt_math', 'Fonksiyonların temel kavramları', 24),
  ('tyt_math', 'Permütasyon ve kombinasyon', 25),
  ('tyt_math', 'Olasılık', 26),
  ('tyt_math', 'Veri ve istatistik', 27),
  ('tyt_geometry', 'Doğruda açılar', 1),
  ('tyt_geometry', 'Üçgende açılar', 2),
  ('tyt_geometry', 'Özel üçgenler', 3),
  ('tyt_geometry', 'Dik üçgenler', 4),
  ('tyt_geometry', 'Üçgende açıortay ve kenarortay', 5),
  ('tyt_geometry', 'Üçgende eşlik ve benzerlik', 6),
  ('tyt_geometry', 'Üçgende alan', 7),
  ('tyt_geometry', 'Üçgende açı-kenar bağıntıları', 8),
  ('tyt_geometry', 'Çokgenler', 9),
  ('tyt_geometry', 'Dörtgenler', 10),
  ('tyt_geometry', 'Özel dörtgenler (kare, dikdörtgen, paralelkenar, yamuk, eşkenar dörtgen, deltoid)', 11),
  ('tyt_geometry', 'Çember ve daire', 12),
  ('tyt_geometry', 'Analitik geometri', 13),
  ('tyt_geometry', 'Katı cisimler (prizma, küp, silindir, koni, piramit, küre)', 14),
  ('tyt_physics', 'Fizik bilimine giriş', 1),
  ('tyt_physics', 'Madde ve özellikleri', 2),
  ('tyt_physics', 'Hareket ve kuvvet', 3),
  ('tyt_physics', 'Newton''un hareket yasalarının temelleri', 4),
  ('tyt_physics', 'İş, güç ve enerji', 5),
  ('tyt_physics', 'Isı, sıcaklık ve genleşme', 6),
  ('tyt_physics', 'Basınç', 7),
  ('tyt_physics', 'Kaldırma kuvveti', 8),
  ('tyt_physics', 'Elektrostatik', 9),
  ('tyt_physics', 'Elektrik akımı ve devreler', 10),
  ('tyt_physics', 'Mıknatıslar ve manyetizma', 11),
  ('tyt_physics', 'Dalgalar', 12),
  ('tyt_physics', 'Optik (aydınlanma, gölge, yansıma, aynalar, kırılma, mercekler)', 13),
  ('tyt_chemistry', 'Kimya bilimi', 1),
  ('tyt_chemistry', 'Atom ve periyodik sistem', 2),
  ('tyt_chemistry', 'Kimyasal türler arası etkileşimler', 3),
  ('tyt_chemistry', 'Maddenin hâlleri', 4),
  ('tyt_chemistry', 'Doğa ve kimya', 5),
  ('tyt_chemistry', 'Kimyanın temel kanunları', 6),
  ('tyt_chemistry', 'Mol kavramı ve kimyasal hesaplamalar', 7),
  ('tyt_chemistry', 'Karışımlar', 8),
  ('tyt_chemistry', 'Karışımları ayırma yöntemleri', 9),
  ('tyt_chemistry', 'Asitler, bazlar ve tuzlar', 10),
  ('tyt_chemistry', 'Kimya her yerde', 11),
  ('tyt_biology', 'Canlıların ortak özellikleri', 1),
  ('tyt_biology', 'Canlıların temel bileşenleri', 2),
  ('tyt_biology', 'İnorganik ve organik bileşikler', 3),
  ('tyt_biology', 'Hücre ve organeller', 4),
  ('tyt_biology', 'Hücre zarından madde geçişleri', 5),
  ('tyt_biology', 'Canlıların sınıflandırılması', 6),
  ('tyt_biology', 'Mitoz bölünme ve eşeysiz üreme', 7),
  ('tyt_biology', 'Mayoz bölünme ve eşeyli üreme', 8),
  ('tyt_biology', 'Kalıtımın temel ilkeleri', 9),
  ('tyt_biology', 'Ekosistem ekolojisi', 10),
  ('tyt_biology', 'Madde döngüleri', 11),
  ('tyt_biology', 'Güncel çevre sorunları', 12),
  ('tyt_history', 'Tarih ve zaman', 1),
  ('tyt_history', 'İnsanlığın ilk dönemleri', 2),
  ('tyt_history', 'İlk Çağ uygarlıkları', 3),
  ('tyt_history', 'İlk ve Orta Çağlarda Türk dünyası', 4),
  ('tyt_history', 'İslam medeniyetinin doğuşu', 5),
  ('tyt_history', 'İlk Türk-İslam devletleri', 6),
  ('tyt_history', 'Orta Çağ''da dünya', 7),
  ('tyt_history', 'Selçuklu Türkiyesi', 8),
  ('tyt_history', 'Osmanlı Devleti''nin kuruluşu', 9),
  ('tyt_history', 'Osmanlı Devleti''nin yükselme dönemi', 10),
  ('tyt_history', 'Osmanlı kültür ve medeniyeti', 11),
  ('tyt_history', 'Osmanlı Devleti''nde değişim ve yenileşme', 12),
  ('tyt_history', 'XIX. yüzyılda Osmanlı Devleti', 13),
  ('tyt_history', 'XX. yüzyıl başlarında Osmanlı Devleti', 14),
  ('tyt_history', 'I. Dünya Savaşı', 15),
  ('tyt_history', 'Millî Mücadele', 16),
  ('tyt_history', 'Atatürk ilke ve inkılapları', 17),
  ('tyt_geography', 'Doğa ve insan', 1),
  ('tyt_geography', 'Dünya''nın şekli ve hareketleri', 2),
  ('tyt_geography', 'Coğrafi konum', 3),
  ('tyt_geography', 'Harita bilgisi', 4),
  ('tyt_geography', 'Atmosfer ve iklim', 5),
  ('tyt_geography', 'Sıcaklık, basınç ve rüzgârlar', 6),
  ('tyt_geography', 'Nem ve yağış', 7),
  ('tyt_geography', 'İklim tipleri', 8),
  ('tyt_geography', 'Dünya''nın tektonik oluşumu', 9),
  ('tyt_geography', 'Jeolojik zamanlar', 10),
  ('tyt_geography', 'İç ve dış kuvvetler', 11),
  ('tyt_geography', 'Kayaçlar', 12),
  ('tyt_geography', 'Türkiye''nin yer şekilleri', 13),
  ('tyt_geography', 'Su kaynakları, toprak ve bitki örtüsü', 14),
  ('tyt_geography', 'Nüfus ve yerleşme', 15),
  ('tyt_geography', 'Göçler', 16),
  ('tyt_geography', 'Ekonomik faaliyetler', 17),
  ('tyt_geography', 'Bölgeler', 18),
  ('tyt_geography', 'Doğal afetler ve çevre sorunları', 19),
  ('tyt_philosophy', 'Felsefenin konusu ve temel kavramları', 1),
  ('tyt_philosophy', 'Felsefi düşüncenin özellikleri', 2),
  ('tyt_philosophy', 'Bilgi felsefesi', 3),
  ('tyt_philosophy', 'Varlık felsefesi', 4),
  ('tyt_philosophy', 'Ahlak felsefesi', 5),
  ('tyt_philosophy', 'Sanat felsefesi', 6),
  ('tyt_philosophy', 'Din felsefesi', 7),
  ('tyt_philosophy', 'Siyaset felsefesi', 8),
  ('tyt_philosophy', 'Bilim felsefesi', 9),
  ('tyt_philosophy', 'Felsefe tarihinin temel dönemleri', 10),
  ('tyt_religion', 'Bilgi ve inanç', 1),
  ('tyt_religion', 'Allah-insan ilişkisi', 2),
  ('tyt_religion', 'İslam ve ibadet', 3),
  ('tyt_religion', 'İslam''da ahlak ve değerler', 4),
  ('tyt_religion', 'Hz. Muhammed''in hayatı ve örnekliği', 5),
  ('tyt_religion', 'Vahiy ve akıl', 6),
  ('tyt_religion', 'Kur''an ve temel kavramları', 7),
  ('tyt_religion', 'İslam düşüncesinde yorumlar ve mezhepler', 8),
  ('tyt_religion', 'Din, kültür ve medeniyet', 9),
  ('tyt_religion', 'İslam ve bilim', 10),
  ('tyt_religion', 'Yaşayan dinler', 11)
) as v(subject_id, name, display_order)
on conflict (subject_id, normalized_name) do nothing;

insert into public.topic_aliases (subject_id, group_id, alias, normalized_name)
select v.subject_id, g.id, v.alias, public.normalize_topic_label(v.alias)
from (values
  ('tyt_biology', 'Canlıların ortak özellikleri', 'Biyoloji ve Canlıların Ortak Özellikleri'),
  ('tyt_biology', 'İnorganik ve organik bileşikler', 'Canlılardaki Organik Bileşikler'),
  ('tyt_biology', 'İnorganik ve organik bileşikler', 'Karbonhidratlar'),
  ('tyt_biology', 'Hücre ve organeller', 'Golgi Aygıtı'),
  ('tyt_biology', 'Hücre ve organeller', 'Hücre'),
  ('tyt_biology', 'Hücre ve organeller', 'Hücre Doku Organ Sistem'),
  ('tyt_biology', 'Canlıların sınıflandırılması', 'Canlı Alemleri ve Özellikleri'),
  ('tyt_biology', 'Canlıların sınıflandırılması', 'Canlıların Çeşitliliği ve Sınıflandırılması'),
  ('tyt_biology', 'Mitoz bölünme ve eşeysiz üreme', 'Eşeysiz Üreme'),
  ('tyt_biology', 'Mitoz bölünme ve eşeysiz üreme', 'Mitoz Bölünme'),
  ('tyt_biology', 'Mayoz bölünme ve eşeyli üreme', 'Eşeyli Üreme'),
  ('tyt_biology', 'Mayoz bölünme ve eşeyli üreme', 'Mayoz Bölünme'),
  ('tyt_biology', 'Kalıtımın temel ilkeleri', 'Çaprazlamalar'),
  ('tyt_biology', 'Kalıtımın temel ilkeleri', 'Eşeye Bağlı Kalıtım'),
  ('tyt_biology', 'Kalıtımın temel ilkeleri', 'Kalıtım'),
  ('tyt_biology', 'Kalıtımın temel ilkeleri', 'Kalıtımın Temel Kavramları'),
  ('tyt_biology', 'Kalıtımın temel ilkeleri', 'Kan Grupları'),
  ('tyt_biology', 'Ekosistem ekolojisi', 'Ekosistem Kavramları'),
  ('tyt_biology', 'Ekosistem ekolojisi', 'Ekosistemde Enerji Akışı'),
  ('tyt_biology', 'Ekosistem ekolojisi', 'Simbiyotik İlişkiler'),
  ('tyt_chemistry', 'Kimya bilimi', 'Kimya Uygulamalarında İş Sağlığı ve Güvenliği'),
  ('tyt_chemistry', 'Atom ve periyodik sistem', 'Elementlerin Periyodik Sistemdeki Yerleri'),
  ('tyt_chemistry', 'Atom ve periyodik sistem', 'Periyodik Özelliklerin Değişimi'),
  ('tyt_chemistry', 'Kimyasal türler arası etkileşimler', 'Güçlü Etkileşimler'),
  ('tyt_chemistry', 'Kimyasal türler arası etkileşimler', 'Kimyasal Tür'),
  ('tyt_chemistry', 'Kimyasal türler arası etkileşimler', 'Lewis Formülleri'),
  ('tyt_chemistry', 'Kimyasal türler arası etkileşimler', 'Zayıf Etkileşimler'),
  ('tyt_chemistry', 'Maddenin hâlleri', 'Buharlaşma, Yoğuşma ve Denge Buhar Basıncı'),
  ('tyt_chemistry', 'Maddenin hâlleri', 'Katılar'),
  ('tyt_chemistry', 'Maddenin hâlleri', 'Sıvılar'),
  ('tyt_chemistry', 'Maddenin hâlleri', 'Sıvılarda Viskozite'),
  ('tyt_chemistry', 'Mol kavramı ve kimyasal hesaplamalar', 'Kimyasal Tepkimeler ve Denklemler'),
  ('tyt_chemistry', 'Mol kavramı ve kimyasal hesaplamalar', 'Kimyasal Tepkimelerde Hesaplamalar'),
  ('tyt_chemistry', 'Mol kavramı ve kimyasal hesaplamalar', 'Mol Kavramı'),
  ('tyt_chemistry', 'Karışımlar', 'Çözeltilerin Özellikleri'),
  ('tyt_chemistry', 'Karışımlar', 'Çözünme Süreci'),
  ('tyt_chemistry', 'Karışımlar', 'Çözünmüş Madde Oranlarını Belirten İfadeler'),
  ('tyt_chemistry', 'Karışımlar', 'Homojen ve Heterojen Karışımlar'),
  ('tyt_chemistry', 'Karışımları ayırma yöntemleri', 'Ayırma ve Saflaştırma Teknikleri'),
  ('tyt_chemistry', 'Asitler, bazlar ve tuzlar', 'Asit ve Bazların Metallerle Etkileşimi'),
  ('tyt_chemistry', 'Asitler, bazlar ve tuzlar', 'Asitlerin ve Bazların Tepkimeleri'),
  ('tyt_chemistry', 'Kimya her yerde', 'Yaygın Günlük Hayat Kimyasalları'),
  ('tyt_geography', 'Doğa ve insan', 'Coğrafyanın Konusu'),
  ('tyt_geography', 'Doğa ve insan', 'Doğa ve İnsan Etkileşimi'),
  ('tyt_geography', 'Coğrafi konum', 'Coğrafi Koordinat Sistemi'),
  ('tyt_geography', 'Coğrafi konum', 'Ülkemizin Coğrafi Konumu'),
  ('tyt_geography', 'Atmosfer ve iklim', 'Atmosfer ve Hava Olayları'),
  ('tyt_geography', 'Atmosfer ve iklim', 'İklim Bilgisi'),
  ('tyt_geography', 'İklim tipleri', 'Dünyadaki İklim Tipleri'),
  ('tyt_geography', 'İklim tipleri', 'Ülkemizde İklim'),
  ('tyt_geography', 'Dünya''nın tektonik oluşumu', 'Dünya’nın Yapısı ve Oluşum Süreci'),
  ('tyt_geography', 'İç ve dış kuvvetler', 'Dış Kuvvetler'),
  ('tyt_geography', 'İç ve dış kuvvetler', 'İç Kuvvetler'),
  ('tyt_geography', 'Türkiye''nin yer şekilleri', 'Türkiye''deki Yer Şekillerinin Oluşumu'),
  ('tyt_geography', 'Su kaynakları, toprak ve bitki örtüsü', 'Toprağın Hikayesi'),
  ('tyt_geography', 'Su kaynakları, toprak ve bitki örtüsü', 'Türkiye’de Toprak Tipleri ve Dağılışı'),
  ('tyt_geography', 'Su kaynakları, toprak ve bitki örtüsü', 'Türkiye''nin Bitki Örtüsü'),
  ('tyt_geography', 'Nüfus ve yerleşme', 'Nüfus Piramitleri'),
  ('tyt_geography', 'Nüfus ve yerleşme', 'Nüfusun Özellikleri ve Önemi'),
  ('tyt_geography', 'Nüfus ve yerleşme', 'Türkiye Nüfusunun Yapısı ve Özellikleri'),
  ('tyt_geography', 'Nüfus ve yerleşme', 'Türkiye’de Nüfus ve Yerleşme'),
  ('tyt_geography', 'Göçler', 'İnsanlar Neden Göç Eder?'),
  ('tyt_geography', 'Ekonomik faaliyetler', 'Ulaşım Türleri'),
  ('tyt_geography', 'Bölgeler', 'Bölge Kavramı ve Türleri'),
  ('tyt_geography', 'Bölgeler', 'Bölgeler ve Ülkeler'),
  ('tyt_geography', 'Doğal afetler ve çevre sorunları', 'Afetlerden Korunma'),
  ('tyt_geography', 'Doğal afetler ve çevre sorunları', 'Doğal Afetler'),
  ('tyt_geography', 'Doğal afetler ve çevre sorunları', 'Doğal Kaynaklar ve Çevre Sorunları'),
  ('tyt_geography', 'Doğal afetler ve çevre sorunları', 'Türkiye''de Doğal Afetler'),
  ('tyt_geometry', 'Üçgende açılar', 'Üçgende Temel Kavramlar'),
  ('tyt_geometry', 'Özel üçgenler', 'Açılarına Göre Özel Üçgenler'),
  ('tyt_geometry', 'Özel üçgenler', 'İkizkenar Üçgen'),
  ('tyt_geometry', 'Dik üçgenler', 'Dik Üçgen'),
  ('tyt_geometry', 'Dik üçgenler', 'Pisagor'),
  ('tyt_geometry', 'Üçgende açıortay ve kenarortay', 'Açıortay Özellikleri'),
  ('tyt_geometry', 'Üçgende açıortay ve kenarortay', 'Üçgende Açıortay'),
  ('tyt_geometry', 'Üçgende açıortay ve kenarortay', 'Üçgende Kenarortay'),
  ('tyt_geometry', 'Dörtgenler', 'Dörtgenlerde Açı Özellikleri'),
  ('tyt_geometry', 'Özel dörtgenler (kare, dikdörtgen, paralelkenar, yamuk, eşkenar dörtgen, deltoid)', 'Dikdörtgen'),
  ('tyt_geometry', 'Özel dörtgenler (kare, dikdörtgen, paralelkenar, yamuk, eşkenar dörtgen, deltoid)', 'Dörtgenler-Deltoid'),
  ('tyt_geometry', 'Özel dörtgenler (kare, dikdörtgen, paralelkenar, yamuk, eşkenar dörtgen, deltoid)', 'Kare'),
  ('tyt_geometry', 'Özel dörtgenler (kare, dikdörtgen, paralelkenar, yamuk, eşkenar dörtgen, deltoid)', 'Paralelkenar'),
  ('tyt_geometry', 'Özel dörtgenler (kare, dikdörtgen, paralelkenar, yamuk, eşkenar dörtgen, deltoid)', 'Yamuk'),
  ('tyt_geometry', 'Katı cisimler (prizma, küp, silindir, koni, piramit, küre)', 'Dik Prizmalarda Alan ve Hacim'),
  ('tyt_geometry', 'Katı cisimler (prizma, küp, silindir, koni, piramit, küre)', 'Prizmalar'),
  ('tyt_history', 'İlk ve Orta Çağlarda Türk dünyası', 'Kavimler Göçü'),
  ('tyt_history', 'İlk ve Orta Çağlarda Türk dünyası', 'Türklerde Coğrafya ile Oluşan Yaşam Tarzı'),
  ('tyt_history', 'İslam medeniyetinin doğuşu', 'Dört Halife Devri'),
  ('tyt_history', 'İslam medeniyetinin doğuşu', 'Emeviler'),
  ('tyt_history', 'İlk Türk-İslam devletleri', 'Büyük Selçuklu Devleti'),
  ('tyt_history', 'İlk Türk-İslam devletleri', 'Büyük Selçuklu Devleti’nde Yönetim ve Toplum'),
  ('tyt_history', 'İlk Türk-İslam devletleri', 'İlk Türk İslam Devletleri'),
  ('tyt_history', 'İlk Türk-İslam devletleri', 'İslamiyet''i Kabul Eden İlk Topluluklar'),
  ('tyt_history', 'İlk Türk-İslam devletleri', 'Türklerin İslamiyet’i Kabulü'),
  ('tyt_history', 'Orta Çağ''da dünya', 'Orta Çağ’da Siyasi Yapılar'),
  ('tyt_history', 'Selçuklu Türkiyesi', 'Anadolu''da Kurulan İlk Türk Beylikleri'),
  ('tyt_history', 'Osmanlı Devleti''nin kuruluşu', 'Beylikten Devlete Osmanlı Siyaseti'),
  ('tyt_history', 'Osmanlı Devleti''nin yükselme dönemi', 'Fetih ve Fatih'),
  ('tyt_history', 'Osmanlı Devleti''nin yükselme dönemi', 'İslam Dünyası Liderliği'),
  ('tyt_history', 'Osmanlı kültür ve medeniyeti', 'Klasik Çağda Osmanlı Toplum Düzeni'),
  ('tyt_history', 'Osmanlı kültür ve medeniyeti', 'Osmanlı Devleti''nin Yönetim Yapısı'),
  ('tyt_history', 'Osmanlı Devleti''nde değişim ve yenileşme', 'Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti'),
  ('tyt_history', 'Osmanlı Devleti''nde değişim ve yenileşme', 'Uluslararası İlişkilerde Denge Stratejisi'),
  ('tyt_history', 'XIX. yüzyılda Osmanlı Devleti', 'Devrimler Çağında Devlet-Toplum İlişkileri'),
  ('tyt_history', 'XX. yüzyıl başlarında Osmanlı Devleti', 'I. Dünya Savaşı’nın Sonuçları'),
  ('tyt_history', 'Millî Mücadele', 'Büyük Millet Meclisinin Açılması'),
  ('tyt_history', 'Millî Mücadele', 'İşgallerin Başlaması ve Millî Mücadele''ye Hazırlık'),
  ('tyt_history', 'Millî Mücadele', 'Milli Mücadele'),
  ('tyt_history', 'Millî Mücadele', 'Mudanya’dan Lozan’a'),
  ('tyt_history', 'Millî Mücadele', 'Sevr Antlaşması'),
  ('tyt_history', 'Atatürk ilke ve inkılapları', 'Atatürk İlkeleri'),
  ('tyt_history', 'Atatürk ilke ve inkılapları', 'Atatürkçülük ve Türk İnkılabı'),
  ('tyt_history', 'Atatürk ilke ve inkılapları', 'Ekonomi Alanındaki Gelişmeler'),
  ('tyt_history', 'Atatürk ilke ve inkılapları', 'Siyasi Alanda Yapılan İnkılaplar'),
  ('tyt_math', 'Temel kavramlar', 'Ardışık Sayılar'),
  ('tyt_math', 'Temel kavramlar', 'Asal Sayılar'),
  ('tyt_math', 'Temel kavramlar', 'Faktöriyel Kavramı'),
  ('tyt_math', 'Temel kavramlar', 'İşlem Yeteneği'),
  ('tyt_math', 'Temel kavramlar', 'Tek Çift Sayılar'),
  ('tyt_math', 'Bölme ve bölünebilme', 'Asal Çarpanlara Ayırma'),
  ('tyt_math', 'Bölme ve bölünebilme', 'Bölme Bölünebilme'),
  ('tyt_math', 'EBOB ve EKOK', 'OBEB OKEK'),
  ('tyt_math', 'EBOB ve EKOK', 'OBEB OKEK Problemleri'),
  ('tyt_math', 'Rasyonel sayılar', 'Ondalık Sayılar'),
  ('tyt_math', 'Basit eşitsizlikler', 'Eşitsizlik Problemleri'),
  ('tyt_math', 'Mutlak değer', 'Mutlak Değerli Denkemler'),
  ('tyt_math', 'Mutlak değer', 'Mutlak Değerli Eşitsizlikler'),
  ('tyt_math', 'Üslü sayılar', 'Üslü Denklemler'),
  ('tyt_math', 'Üslü sayılar', 'Üslü İfadeler'),
  ('tyt_math', 'Köklü sayılar', 'Köklü İfade İçeren Denklemler'),
  ('tyt_math', 'Köklü sayılar', 'Köklü İfadeler'),
  ('tyt_math', 'Oran ve orantı', 'Oran Orantı Problemleri'),
  ('tyt_math', 'Oran ve orantı', 'Oran-Orantı'),
  ('tyt_math', 'Birinci dereceden denklemler', 'Denklem ve Eşitsizlikler'),
  ('tyt_math', 'Sayı ve kesir problemleri', 'Kesir Problemleri'),
  ('tyt_math', 'Sayı ve kesir problemleri', 'Sayı Problemleri'),
  ('tyt_math', 'Yüzde, kâr ve zarar problemleri', 'Alışveriş-Kar-Zarar Problemleri'),
  ('tyt_math', 'Yüzde, kâr ve zarar problemleri', 'Yüzde Problemleri'),
  ('tyt_math', 'Tablo ve grafik problemleri', 'Cebirsel Tablolar ve İşlemler'),
  ('tyt_math', 'Tablo ve grafik problemleri', 'Grafik İçeren Problemler'),
  ('tyt_math', 'Rutin olmayan problemler', 'Sayısal Mantık ve Güncel Problemler'),
  ('tyt_math', 'Rutin olmayan problemler', 'Temel Mantıksal Problemler'),
  ('tyt_math', 'Kümeler', 'İki Kümenin Kartezyen Çarpımı'),
  ('tyt_math', 'Kümeler', 'Kümelerde İşlemler'),
  ('tyt_math', 'Mantık', 'Bileşik Önermeler'),
  ('tyt_math', 'Mantık', 'Önermeler'),
  ('tyt_math', 'Fonksiyonların temel kavramları', 'Bir Fonksiyonun Grafiği'),
  ('tyt_math', 'Fonksiyonların temel kavramları', 'Fonksiyon Grafikleri'),
  ('tyt_math', 'Fonksiyonların temel kavramları', 'Fonksiyon Tanımı ve Kavramı'),
  ('tyt_math', 'Fonksiyonların temel kavramları', 'Fonksiyonlar'),
  ('tyt_math', 'Fonksiyonların temel kavramları', 'İki Fonksiyonun Bileşkesi'),
  ('tyt_math', 'Permütasyon ve kombinasyon', 'Kombinasyon'),
  ('tyt_math', 'Permütasyon ve kombinasyon', 'Permütasyon'),
  ('tyt_math', 'Permütasyon ve kombinasyon', 'Saymanın Temel İlkesi'),
  ('tyt_math', 'Permütasyon ve kombinasyon', 'Toplama ve Çarpma Yöntemleri'),
  ('tyt_math', 'Olasılık', 'Bağımlı ve Bağımsız Olaylar'),
  ('tyt_math', 'Olasılık', 'Basit Olayların Olasılıkları'),
  ('tyt_math', 'Veri ve istatistik', 'İstatistik ve Veri'),
  ('tyt_math', 'Veri ve istatistik', 'Merkezi Eğilim ve Merkezi Yayılım Ölçüleri'),
  ('tyt_math', 'Veri ve istatistik', 'Veri'),
  ('tyt_math', 'Veri ve istatistik', 'Verilerin Grafiklerle Gösterilmesi'),
  ('tyt_philosophy', 'Felsefenin konusu ve temel kavramları', 'Felsefenin Bireysel Ve Toplumsal İşlevleri'),
  ('tyt_philosophy', 'Felsefenin konusu ve temel kavramları', 'Felsefeyi Tanıma'),
  ('tyt_philosophy', 'Felsefi düşüncenin özellikleri', 'Felsefi Düşünce'),
  ('tyt_philosophy', 'Bilgi felsefesi', 'Bilgi Felsefesinin Konusu ve Problemleri'),
  ('tyt_philosophy', 'Varlık felsefesi', 'Varlık Felsefesinin Konusu ve Problemleri'),
  ('tyt_philosophy', 'Ahlak felsefesi', 'Ahlak Felsefesinin Konusu ve Problemleri'),
  ('tyt_philosophy', 'Siyaset felsefesi', 'Siyaset Felsefesinin Konusu ve Problemleri'),
  ('tyt_philosophy', 'Bilim felsefesi', 'Bilim Felsefesinin Konusu ve Problemleri'),
  ('tyt_philosophy', 'Felsefe tarihinin temel dönemleri', '15. Yüzyıl-17. Yüzyıl Felsefesi'),
  ('tyt_philosophy', 'Felsefe tarihinin temel dönemleri', '18.Yüzyıl-19.Yüzyıl Felsefesi'),
  ('tyt_philosophy', 'Felsefe tarihinin temel dönemleri', '20. ve 21. Yüzyıl Felsefecilerinin Görüşleri'),
  ('tyt_philosophy', 'Felsefe tarihinin temel dönemleri', 'MÖ 6. Yüzyıl-MS 2. Yüzyıl Felsefesi'),
  ('tyt_philosophy', 'Felsefe tarihinin temel dönemleri', 'MS 2. Yüzyıl-MS 15. Yüzyıl Felsefesi'),
  ('tyt_physics', 'Fizik bilimine giriş', 'Fizik Bilimi'),
  ('tyt_physics', 'Fizik bilimine giriş', 'Temel ve Türetilmiş Nicelikler'),
  ('tyt_physics', 'Madde ve özellikleri', 'Adezyon ve Kohezyon'),
  ('tyt_physics', 'Madde ve özellikleri', 'Kütle ve Ağırlık'),
  ('tyt_physics', 'Hareket ve kuvvet', 'Düzgün Doğrusal Hareket'),
  ('tyt_physics', 'Hareket ve kuvvet', 'Sabit Hızlı Harekette Konum Zaman Grafiği'),
  ('tyt_physics', 'Newton''un hareket yasalarının temelleri', 'Sürtünme Kuvveti'),
  ('tyt_physics', 'İş, güç ve enerji', 'İş-Güç ve Enerji'),
  ('tyt_physics', 'İş, güç ve enerji', 'Sürtünmesiz Ortamlarda Enerjinin Korunumu'),
  ('tyt_physics', 'Isı, sıcaklık ve genleşme', 'Enerji (Isı ) İletim Yolları'),
  ('tyt_physics', 'Isı, sıcaklık ve genleşme', 'Genleşme'),
  ('tyt_physics', 'Isı, sıcaklık ve genleşme', 'Hal Değişimi ve Isıl Denge'),
  ('tyt_physics', 'Isı, sıcaklık ve genleşme', 'İç Enerji, Isı ve Sıcaklık Arasındaki İlişki'),
  ('tyt_physics', 'Isı, sıcaklık ve genleşme', 'Isı ve Sıcaklık'),
  ('tyt_physics', 'Isı, sıcaklık ve genleşme', 'Isı,Sıcaklık ve İç Enerji Kavramları'),
  ('tyt_physics', 'Kaldırma kuvveti', 'Sıvıların Kaldırma Kuvveti'),
  ('tyt_physics', 'Elektrostatik', 'Elektroskop'),
  ('tyt_physics', 'Elektrostatik', 'İletken ve Yalıtkan Cisimler'),
  ('tyt_physics', 'Elektrik akımı ve devreler', 'Elektrik Akımı'),
  ('tyt_physics', 'Elektrik akımı ve devreler', 'Elektrik Devre Elemanları'),
  ('tyt_physics', 'Elektrik akımı ve devreler', 'Elektrik Enerjisi, Elektriksel Güç'),
  ('tyt_physics', 'Mıknatıslar ve manyetizma', 'Elektrik ve Manyetizma'),
  ('tyt_physics', 'Dalgalar', 'Dalga Mekaniği'),
  ('tyt_physics', 'Dalgalar', 'Elektromanyetik Dalgaların Özellikleri'),
  ('tyt_physics', 'Dalgalar', 'Ses Dalgaları'),
  ('tyt_physics', 'Dalgalar', 'Su Dalgaları'),
  ('tyt_physics', 'Dalgalar', 'Yay Dalgaları'),
  ('tyt_physics', 'Optik (aydınlanma, gölge, yansıma, aynalar, kırılma, mercekler)', 'Aydınlanma'),
  ('tyt_physics', 'Optik (aydınlanma, gölge, yansıma, aynalar, kırılma, mercekler)', 'Aydınlanma Şiddeti'),
  ('tyt_physics', 'Optik (aydınlanma, gölge, yansıma, aynalar, kırılma, mercekler)', 'Düzlem Aynalar'),
  ('tyt_physics', 'Optik (aydınlanma, gölge, yansıma, aynalar, kırılma, mercekler)', 'Gölge'),
  ('tyt_physics', 'Optik (aydınlanma, gölge, yansıma, aynalar, kırılma, mercekler)', 'Küresel Aynalar'),
  ('tyt_religion', 'Bilgi ve inanç', 'İslam İnanç Esaslarının Özellikleri'),
  ('tyt_religion', 'Bilgi ve inanç', 'İslam İnancında İmanın Mahiyeti'),
  ('tyt_religion', 'Bilgi ve inanç', 'İslam''da İnanç Esasları'),
  ('tyt_religion', 'Bilgi ve inanç', 'İslamda Bilgi Kaynakları'),
  ('tyt_religion', 'Allah-insan ilişkisi', 'Allah İnsan İlişkisi'),
  ('tyt_religion', 'İslam''da ahlak ve değerler', 'Ahlaki Tutum ve Davranışlar'),
  ('tyt_religion', 'İslam''da ahlak ve değerler', 'Gençlik ve Değerler'),
  ('tyt_religion', 'Hz. Muhammed''in hayatı ve örnekliği', 'Hz. Muhammed ve Genç Sahabiler'),
  ('tyt_religion', 'Hz. Muhammed''in hayatı ve örnekliği', 'Hz. Muhammed’in Şahsiyeti'),
  ('tyt_religion', 'Hz. Muhammed''in hayatı ve örnekliği', 'Kur’an’a Göre Hz. Muhammed'),
  ('tyt_religion', 'Kur''an ve temel kavramları', 'Kur’an’da Bazı Kavramlar'),
  ('tyt_religion', 'İslam düşüncesinde yorumlar ve mezhepler', 'İslam Düşüncesinde İtikadi Yorumlar'),
  ('tyt_religion', 'İslam düşüncesinde yorumlar ve mezhepler', 'İslam Düşüncesinde Tasavvufi Yorumlar'),
  ('tyt_religion', 'Din, kültür ve medeniyet', 'Anadolu’da İslam'),
  ('tyt_religion', 'Din, kültür ve medeniyet', 'Din ve Çevre'),
  ('tyt_religion', 'Din, kültür ve medeniyet', 'Din ve Hayat'),
  ('tyt_religion', 'Din, kültür ve medeniyet', 'Gönül Coğrafyamız'),
  ('tyt_turkish', 'Sözcükte anlam', 'Anlam İlişkileri'),
  ('tyt_turkish', 'Sözcükte anlam', 'Cümleye Sözcük Yerleştirme'),
  ('tyt_turkish', 'Sözcükte anlam', 'Söz Öbekleri'),
  ('tyt_turkish', 'Cümlede anlam', 'Cümle Tamamlama'),
  ('tyt_turkish', 'Cümlede anlam', 'Cümlede Anlam İlişkileri'),
  ('tyt_turkish', 'Cümlede anlam', 'İki Cümleyi Birleştirme'),
  ('tyt_turkish', 'Paragrafta anlam', 'Paragrafın Konusu'),
  ('tyt_turkish', 'Paragrafta anlam', 'Paragrafta Cümle Yorumlama'),
  ('tyt_turkish', 'Paragrafta anlam', 'Röportaj-Diyalog Soruları'),
  ('tyt_turkish', 'Paragrafta anlam', 'Soruya Cevap Olan Paragraflar'),
  ('tyt_turkish', 'Paragrafta ana düşünce ve yardımcı düşünce', 'Paragrafın Ana Düşüncesi'),
  ('tyt_turkish', 'Paragrafta ana düşünce ve yardımcı düşünce', 'Paragrafta Yardımcı Düşünceler'),
  ('tyt_turkish', 'Paragrafta yapı', 'Düşünce Akışını Bozan Cümle'),
  ('tyt_turkish', 'Paragrafta yapı', 'İki Paragrafı Karşılaştırma'),
  ('tyt_turkish', 'Paragrafta yapı', 'Paragraf Oluşturma'),
  ('tyt_turkish', 'Paragrafta yapı', 'Paragrafa Cümle Ekleme'),
  ('tyt_turkish', 'Paragrafta yapı', 'Paragrafı İki Parçaya Ayırma'),
  ('tyt_turkish', 'Paragrafta yapı', 'Paragrafın Yapısı'),
  ('tyt_turkish', 'Paragrafta yapı', 'Paragrafta Cümlelerin Yerini Değiştirme'),
  ('tyt_turkish', 'Anlatım biçimleri', 'Anlatım Türleri'),
  ('tyt_turkish', 'Ses bilgisi ve ses olayları', 'Ses Bilgisi'),
  ('tyt_turkish', 'Yazım kuralları', '-de Eki ve Bağlacının Yazılışı'),
  ('tyt_turkish', 'Yazım kuralları', 'Bitişik Yazılan Birleşik Kelimeler'),
  ('tyt_turkish', 'Yazım kuralları', 'Büyük Harflerin Kullanıldığı Yerler'),
  ('tyt_turkish', 'Yazım kuralları', 'Özel Adların Yazılışı'),
  ('tyt_turkish', 'Noktalama işaretleri', 'Nokta'),
  ('tyt_turkish', 'Noktalama işaretleri', 'Noktalı Virgül'),
  ('tyt_turkish', 'Noktalama işaretleri', 'Üç Nokta'),
  ('tyt_turkish', 'Noktalama işaretleri', 'Virgül'),
  ('tyt_turkish', 'Sözcükte yapı ve ekler', 'Çekim Ekleri'),
  ('tyt_turkish', 'Sözcükte yapı ve ekler', 'Ekler'),
  ('tyt_turkish', 'Sözcük türleri (isim, sıfat, zamir, zarf, edat, bağlaç, ünlem)', 'İsim Tamlaması'),
  ('tyt_turkish', 'Sözcük türleri (isim, sıfat, zamir, zarf, edat, bağlaç, ünlem)', 'Sözcük Türleri'),
  ('tyt_turkish', 'Sözcük türleri (isim, sıfat, zamir, zarf, edat, bağlaç, ünlem)', 'Tamlamalar'),
  ('tyt_turkish', 'Sözcük türleri (isim, sıfat, zamir, zarf, edat, bağlaç, ünlem)', 'Zarf'),
  ('tyt_turkish', 'Fiilimsiler', 'İsim Fiil'),
  ('tyt_turkish', 'Deyimler ve atasözleri', 'Deyimler Atasözleri Özdeyişler')
) as v(subject_id, group_name, alias)
join public.topic_groups g
  on g.subject_id = v.subject_id
 and g.normalized_name = public.normalize_topic_label(v.group_name)
on conflict (subject_id, normalized_name) do nothing;

create or replace function public.resolve_topic_group(subject text, label text)
returns uuid
language sql stable security invoker set search_path='' as $$
  select (array_agg(distinct hit))[1]
  from (
    select g.id as hit
    from public.topic_groups g
    where g.subject_id = subject and g.normalized_name = public.normalize_topic_label(label)
    union
    select a.group_id
    from public.topic_aliases a
    where a.subject_id = subject and a.normalized_name = public.normalize_topic_label(label)
  ) matches
  having count(distinct hit) = 1
$$;

create or replace function public.tyt_exam_ids(exam_limit integer)
returns uuid[]
language plpgsql stable security invoker set search_path='' as $$
begin
  if exam_limit is not null and exam_limit not in (5, 10) then raise exception 'INVALID_RANGE'; end if;
  if exam_limit is null then
    return coalesce((select array_agg(id order by exam_date, id) from public.exams where exam_type='TYT'), '{}');
  end if;
  return coalesce((
    select array_agg(id order by exam_date, id) from (
      select id, exam_date from public.exams
      where exam_type='TYT'
      order by exam_date desc, id desc
      limit exam_limit
    ) recent
  ), '{}');
end $$;

create or replace function public.tyt_topic_analysis(exam_limit integer)
returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare selected uuid[];
begin
  selected := public.tyt_exam_ids(exam_limit);
  return jsonb_build_object(
    'exam_total', (select count(*)::int from public.exams where exam_type='TYT'),
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'exam_date', e.exam_date) order by e.exam_date, e.id)
      from public.exams e where e.id = any(selected)
    ), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'parent_id', s.parent_id, 'display_order', s.display_order) order by s.display_order)
      from public.subjects s where s.exam_type='TYT'
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'subject_id', g.subject_id, 'name', g.name, 'display_order', g.display_order) order by s.display_order, g.display_order)
      from public.topic_groups g
      join public.subjects s on s.id = g.subject_id
      where s.exam_type='TYT'
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'subject_id', t.subject_id,
        'group_id', t.group_id,
        'needs_review', t.needs_review,
        'valid', coalesce(c.valid, 0),
        'correct', coalesce(c.correct, 0),
        'wrong', coalesce(c.wrong, 0),
        'blank', coalesce(c.blank, 0),
        'cancelled', coalesce(c.cancelled, 0),
        'exam_ids', coalesce(c.exam_ids, '[]'::jsonb)
      ) order by t.subject_id, t.name)
      from public.topics t
      join public.subjects s on s.id = t.subject_id and s.exam_type='TYT'
      left join (
        select q.topic_id,
          count(*) filter (where q.correct_answer <> 'İPTAL')::int as valid,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer = q.correct_answer)::int as correct,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer is not null and q.selected_answer <> q.correct_answer)::int as wrong,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer is null)::int as blank,
          count(*) filter (where q.correct_answer = 'İPTAL')::int as cancelled,
          coalesce(jsonb_agg(distinct q.exam_id) filter (where q.correct_answer <> 'İPTAL'), '[]'::jsonb) as exam_ids
        from public.exam_questions q
        where q.exam_id = any(selected)
        group by q.topic_id
      ) c on c.topic_id = t.id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.topic_exam_breakdown(target_topic uuid, exam_limit integer)
returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare selected uuid[];
begin
  if target_topic is null then raise exception 'TOPIC_NOT_FOUND'; end if;
  selected := public.tyt_exam_ids(exam_limit);
  return jsonb_build_object(
    'topic', (
      select jsonb_build_object(
        'id', t.id, 'name', t.name, 'subject_id', t.subject_id, 'group_id', t.group_id,
        'group_name', g.name, 'needs_review', t.needs_review
      )
      from public.topics t
      left join public.topic_groups g on g.id = t.group_id
      where t.id = target_topic
    ),
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'exam_date', e.exam_date,
        'valid', c.valid, 'correct', c.correct, 'wrong', c.wrong, 'blank', c.blank, 'cancelled', c.cancelled,
        'questions', c.questions
      ) order by e.exam_date, e.id)
      from public.exams e
      join (
        select q.exam_id,
          count(*) filter (where q.correct_answer <> 'İPTAL')::int as valid,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer = q.correct_answer)::int as correct,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer is not null and q.selected_answer <> q.correct_answer)::int as wrong,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer is null)::int as blank,
          count(*) filter (where q.correct_answer = 'İPTAL')::int as cancelled,
          jsonb_agg(jsonb_build_object(
            'question_number', q.question_number,
            'subject_id', q.subject_id,
            'correct_answer', q.correct_answer,
            'selected_answer', nullif(btrim(q.selected_answer::text), ''),
            'solution_url', q.solution_url
          ) order by q.question_number) as questions
        from public.exam_questions q
        where q.topic_id = target_topic and q.exam_id = any(selected)
        group by q.exam_id
      ) c on c.exam_id = e.id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.topic_admin_catalog()
returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  return public.tyt_topic_analysis(null) || jsonb_build_object('aliases', coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'subject_id', a.subject_id, 'group_id', a.group_id, 'alias', a.alias) order by a.subject_id, a.alias)
    from public.topic_aliases a
  ), '[]'::jsonb));
end $$;

create or replace function public.assign_topic_group(target_topic uuid, target_group uuid, admin_session_hash text)
returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare topic public.topics; destination public.topic_groups;
begin
  if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(73242341);
  select * into topic from public.topics where id=target_topic;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if target_group is null then
    update public.topics set group_id=null where id=target_topic;
    delete from public.topic_aliases where subject_id=topic.subject_id and normalized_name=topic.normalized_name;
    return jsonb_build_object('status','unassigned','topic_id',target_topic);
  end if;
  select * into destination from public.topic_groups where id=target_group;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if destination.subject_id is distinct from topic.subject_id then raise exception 'SUBJECT_MISMATCH'; end if;
  update public.topics set group_id=target_group where id=target_topic;
  if topic.normalized_name = destination.normalized_name
     or exists(select 1 from public.topic_groups g where g.subject_id=topic.subject_id and g.normalized_name=topic.normalized_name) then
    delete from public.topic_aliases where subject_id=topic.subject_id and normalized_name=topic.normalized_name;
  else
    insert into public.topic_aliases (subject_id, group_id, alias, normalized_name)
    values (topic.subject_id, target_group, topic.name, topic.normalized_name)
    on conflict (subject_id, normalized_name) do update set group_id=excluded.group_id, alias=excluded.alias;
  end if;
  return jsonb_build_object('status','assigned','topic_id',target_topic,'group_id',target_group);
end $$;

create or replace function public.save_topic_alias(target_alias uuid, target_subject text, target_group uuid, alias_text text, admin_session_hash text)
returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare destination public.topic_groups; normalized text; saved uuid; existing_topic public.topics;
begin
  if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
  if alias_text is null or length(btrim(alias_text)) not between 1 and 300 or alias_text ~ '[[:cntrl:]]' then raise exception 'INVALID_ALIAS'; end if;
  perform pg_advisory_xact_lock(73242341);
  select * into destination from public.topic_groups where id=target_group;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if destination.subject_id is distinct from target_subject then raise exception 'SUBJECT_MISMATCH'; end if;
  normalized := public.normalize_topic_label(btrim(alias_text));
  if normalized = '' then raise exception 'INVALID_ALIAS'; end if;
  if exists(select 1 from public.topic_groups g where g.subject_id=target_subject and g.normalized_name=normalized) then raise exception 'ALIAS_MATCHES_GROUP'; end if;
  select * into existing_topic from public.topics t where t.subject_id=target_subject and t.normalized_name=normalized;
  if found and existing_topic.group_id is not null and existing_topic.group_id is distinct from target_group then raise exception 'ALIAS_TOPIC_CONFLICT'; end if;
  if target_alias is null then
    insert into public.topic_aliases (subject_id, group_id, alias, normalized_name)
    values (target_subject, target_group, btrim(alias_text), normalized)
    on conflict (subject_id, normalized_name) do update set group_id=excluded.group_id, alias=excluded.alias
    returning id into saved;
  else
    update public.topic_aliases
      set subject_id=target_subject, group_id=target_group, alias=btrim(alias_text), normalized_name=normalized
      where id=target_alias
      returning id into saved;
    if saved is null then raise exception 'ALIAS_NOT_FOUND'; end if;
  end if;
  if existing_topic.id is not null and existing_topic.group_id is null then
    update public.topics set group_id=target_group where id=existing_topic.id;
  end if;
  return jsonb_build_object('status','saved','alias_id',saved);
end $$;

create or replace function public.delete_topic_alias(target_alias uuid, admin_session_hash text)
returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(73242341);
  delete from public.topic_aliases where id=target_alias;
  if not found then raise exception 'ALIAS_NOT_FOUND'; end if;
  return jsonb_build_object('status','deleted','alias_id',target_alias);
end $$;

create or replace function public.preview_tyt_import(payload jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 select public.find_tyt_duplicate(payload) || jsonb_build_object(
  'topics', coalesce((
    select jsonb_agg(to_jsonb(t)-'created_at') from public.topics t where exists (
      select 1 from jsonb_to_recordset(payload->'questions') q(subject_id text, topic_label text)
      where q.subject_id=t.subject_id and public.normalize_topic_label(q.topic_label)=t.normalized_name)
  ), '[]'::jsonb),
  'unassigned_labels', coalesce((
    select jsonb_agg(distinct jsonb_build_object('subject_id', q.subject_id, 'topic_label', q.topic_label))
    from jsonb_to_recordset(payload->'questions') as q(subject_id text, topic_label text)
    left join public.topics t on t.subject_id=q.subject_id and t.normalized_name=public.normalize_topic_label(q.topic_label)
    where (t.id is not null and t.group_id is null)
       or (t.id is null and public.resolve_topic_group(q.subject_id, q.topic_label) is null)
  ), '[]'::jsonb))
$$;

create or replace function public.import_tyt_exam(payload jsonb, admin_session_hash text) returns jsonb
 language plpgsql volatile security invoker set search_path='' as $$
declare e public.exams; new_id uuid; duplicate jsonb; actual record; result_row public.exam_subject_results; ids text[]; review jsonb; unassigned jsonb;
begin
 if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
 if payload->'exam'->>'exam_type' is distinct from 'TYT' or jsonb_typeof(payload->'questions') is distinct from 'array'
  or jsonb_typeof(payload->'subjects') is distinct from 'array' or jsonb_typeof(payload->'rankings') is distinct from 'array' then raise exception 'INVALID_REPORT'; end if;
 if jsonb_array_length(payload->'questions')<>120 or jsonb_array_length(payload->'subjects')<>13 or jsonb_array_length(payload->'rankings')<>4 then raise exception 'INCOMPLETE_REPORT'; end if;
 if (payload->'exam'->>'total_questions')::integer is distinct from 120 or payload->'exam'->>'source_pdf_path' is not null then raise exception 'INVALID_REPORT'; end if;
 -- Single-student imports are deliberately serialized. The lock covers duplicate
 -- detection, topic creation, and group assignment.
 perform pg_advisory_xact_lock(73242341);
 duplicate:=public.find_tyt_duplicate(payload);
 if duplicate->>'status' <> 'new' then
  select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into review from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=(duplicate->>'exam_id')::uuid and t.needs_review;
  select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into unassigned from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=(duplicate->>'exam_id')::uuid and t.group_id is null;
  return duplicate || jsonb_build_object('review_topics',review,'unassigned_topics',unassigned);
 end if;
 select * into e from jsonb_populate_record(null::public.exams,payload->'exam');
 insert into public.exams(exam_type,name,exam_date,institution_name,class_label,score,total_questions,total_correct,total_wrong,total_blank,total_net,average_net,report_generated_at,source_pdf_path)
 values(e.exam_type,e.name,e.exam_date,e.institution_name,e.class_label,e.score,e.total_questions,e.total_correct,e.total_wrong,e.total_blank,e.total_net,e.average_net,e.report_generated_at,null) returning id into new_id;
 -- Existing topics keep their printed name and group. Only a newly inserted label
 -- receives an unambiguous, subject-specific group match.
 insert into public.topics(subject_id,name,normalized_name,needs_review,group_id)
  select distinct on (subject_id,normalized_name) subject_id,label,normalized_name,label ~ '(…|\.{3})\s*$',public.resolve_topic_group(subject_id,label)
  from (select value->>'subject_id' subject_id,value->>'topic_label' label,
    public.normalize_topic_label(value->>'topic_label') normalized_name,ordinality
    from jsonb_array_elements(payload->'questions') with ordinality) labels
  order by subject_id,normalized_name,ordinality
  on conflict(subject_id,normalized_name) do nothing;
 insert into public.exam_questions(exam_id,question_number,subject_id,topic_id,correct_answer,selected_answer,solution_url)
  select new_id,q.question_number,q.subject_id,t.id,q.correct_answer,q.selected_answer,q.solution_url
  from jsonb_to_recordset(payload->'questions') as q(question_number smallint,subject_id text,topic_label text,correct_answer text,selected_answer text,solution_url text)
  join public.topics t on t.subject_id=q.subject_id and t.normalized_name=public.normalize_topic_label(q.topic_label);
 insert into public.exam_subject_results select new_id,r.subject_id,r.result_scope,r.question_count,r.correct_count,r.wrong_count,r.blank_count,r.net,r.average_net
  from jsonb_to_recordset(payload->'subjects') as r(subject_id text,result_scope text,question_count smallint,correct_count smallint,wrong_count smallint,blank_count smallint,net numeric,average_net numeric);
 insert into public.exam_rankings select new_id,r.scope,r.rank,r.participant_count
  from jsonb_to_recordset(payload->'rankings') as r(scope text,rank integer,participant_count integer);
 select count(*) n,count(*) filter(where correct_answer='İPTAL' or selected_answer=correct_answer) c,count(*) filter(where correct_answer<>'İPTAL' and selected_answer is not null and selected_answer<>correct_answer) w,count(*) filter(where correct_answer<>'İPTAL' and selected_answer is null) b
  into actual from public.exam_questions where exam_id=new_id;
 if actual.n<>120 or actual.c<>e.total_correct or actual.w<>e.total_wrong or actual.b<>e.total_blank then raise exception 'ANSWER_TOTAL_MISMATCH'; end if;
 -- Preserve the printed numbering across related subjects, and require every
 -- direct subject's complete interval. No duplicate physical questions can pass.
 if exists(select 1 from public.subjects s left join public.exam_questions q on q.subject_id=s.id and q.exam_id=new_id
  where s.exam_type='TYT' and s.expected_questions>0 group by s.id,s.expected_questions
  having count(q.id)<>s.expected_questions or min(q.question_number)<>case s.id when 'tyt_geometry' then 31 when 'tyt_geography' then 6 when 'tyt_philosophy' then 11 when 'tyt_religion' then 16 when 'tyt_chemistry' then 8 when 'tyt_biology' then 15 else 1 end
   or max(q.question_number)<>case s.id when 'tyt_geometry' then 40 when 'tyt_geography' then 10 when 'tyt_philosophy' then 15 when 'tyt_religion' then 20 when 'tyt_chemistry' then 14 when 'tyt_biology' then 20 else s.expected_questions end) then raise exception 'SUBJECT_QUESTION_MISMATCH'; end if;
 if exists(select 1 from public.exam_subject_results r join public.subjects s on s.id=r.subject_id where r.exam_id=new_id
  and ((r.result_scope='direct' and coalesce(s.expected_questions,0)=0) or (r.result_scope='aggregate' and r.subject_id not in ('tyt_social','tyt_math','tyt_science')))) then raise exception 'RESULT_SCOPE_MISMATCH'; end if;
 for result_row in select * from public.exam_subject_results where exam_id=new_id loop
  if result_row.result_scope='aggregate' then
   with recursive descendants as(select id from public.subjects where id=result_row.subject_id union select s.id from public.subjects s join descendants d on s.parent_id=d.id)
   select array_agg(id) into ids from descendants;
  else ids:=array[result_row.subject_id]; end if;
  select count(*) n,count(*) filter(where correct_answer='İPTAL' or selected_answer=correct_answer) c,count(*) filter(where correct_answer<>'İPTAL' and selected_answer is not null and selected_answer<>correct_answer) w,count(*) filter(where correct_answer<>'İPTAL' and selected_answer is null) b
   into actual from public.exam_questions where exam_id=new_id and subject_id=any(ids);
  if actual.n<>result_row.question_count or actual.c<>result_row.correct_count or actual.w<>result_row.wrong_count or actual.b<>result_row.blank_count then raise exception 'SUBJECT_RESULT_MISMATCH'; end if;
 end loop;
 select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into review from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=new_id and t.needs_review;
 select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into unassigned from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=new_id and t.group_id is null;
 return jsonb_build_object('status','imported','exam_id',new_id,'review_topics',review,'unassigned_topics',unassigned);
end $$;

revoke all on function
  public.resolve_topic_group(text, text),
  public.tyt_exam_ids(integer),
  public.tyt_topic_analysis(integer),
  public.topic_exam_breakdown(uuid, integer),
  public.topic_admin_catalog(),
  public.assign_topic_group(uuid, uuid, text),
  public.save_topic_alias(uuid, text, uuid, text, text),
  public.delete_topic_alias(uuid, text),
  public.check_topic_alias()
from public, anon, authenticated;
grant execute on function
  public.resolve_topic_group(text, text),
  public.tyt_exam_ids(integer),
  public.tyt_topic_analysis(integer),
  public.topic_exam_breakdown(uuid, integer),
  public.topic_admin_catalog(),
  public.assign_topic_group(uuid, uuid, text),
  public.save_topic_alias(uuid, text, uuid, text, text),
  public.delete_topic_alias(uuid, text)
to service_role;
commit;
