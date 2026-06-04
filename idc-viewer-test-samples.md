# IDC Viewer Testing Sample Set

**IDC data version:** v24  
**Queried:** 2026-06-03

---

## Coverage dimensions

The following dimensions are represented in this sample set. Dimensions marked with ⚠️ are not covered due to gaps in IDC data.

| Dimension | Rationale |
|---|---|
| Modality | Different rendering pipelines per modality (windowing, LUT, units) |
| Transfer syntax | Decoder coverage — 9 distinct syntaxes in IDC, including a retired one (Big Endian) |
| Series size (# instances) | Performance range: 1 instance → 2,864 instances |
| WSI pixel matrix size | Performance range: 1,600×1,200 px → 189,184×448,768 px |
| File size (MB/GB) | Memory pressure and streaming behavior differ by 5 orders of magnitude |
| Image-derived object type | SEG, RTSTRUCT, RTDOSE, SR, REG, PR, RWV, RTPLAN, ANN, M3D — each needs distinct rendering |
| Illumination type (pathology) | Brightfield vs. epifluorescence — completely different rendering pipelines |
| Staining type (pathology) | H&E vs. IHC vs. May-Grünwald Giemsa vs. multi-antibody fluorescence panels |
| Multi-frame / 4D | 4D-CT (gated phases), DCE-MRI (temporal series) — timeline scrubbing |
| Study composition | Single-series study vs. multi-modality (PET/CT), multi-sequence MRI — study-level layout |
| Mixed transfer syntax within series | Some IDC series have instances encoded with different TSes — pathological case that can crash decoders |
| Photometric interpretation | MONOCHROME1 vs MONOCHROME2 (affects inversion), RGB, YBR_FULL_422 (JPEG-compressed color) |
| Bit depth / pixel representation | 8-bit unsigned (SC, pathology), 12/16-bit signed (CT, MR), affects windowing range |
| Enhanced vs. legacy DICOM | Enhanced CT/MR stores all frames in one file with functional groups; legacy = one file per slice |
| Number of pyramid levels (pathology) | Single-level (thumbnail only) vs. full pyramid — affects zoom/pan navigation |
| Number of channels (pathology) | 3-channel RGB vs. 20–30 channel fluorescence — channel selector UI |
| Linked series | SEG/RTSTRUCT referencing source image series in same study — tests cross-series synchronization |

**Known gaps:** RF (fluoroscopy), dynamic PET (rare in IDC), Enhanced DICOM multi-frame CT/MR (IDC is overwhelmingly legacy single-frame), JPEG Extended (`1.2.840.10008.1.2.4.51` — 151 series total, all pathology).

---

## Radiology samples

**Viewer URL pattern:**
```
https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs={StudyInstanceUID}&initialSeriesInstanceUID={SeriesInstanceUID}
```

### Modality × volume size

| # | Category | Collection | Modality | Transfer Syntax | Instances | Size (MB) | Notes | Viewer |
|---|---|---|---|---|---|---|---|---|
| R1 | CT — large volume | `rider_lung_pet_ct` | CT | EVR-LE | 2,864 | 1,507 | Cardiac-gated, 0.625 mm slice — stress tests scroll performance | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.9328.50.17.160615776127383877801997638127387345147&initialSeriesInstanceUID=1.3.6.1.4.1.9328.50.17.3212576209713183142629060667025805170) |
| R2 | CT — small volume | `4d_lung` | CT | IVR-LE | 2 | 1 | Single 4D gated phase, 2 slices | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.6834.5010.182437046600929846066634413619&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.6834.5010.128956914596594611910155951628) |
| R3 | CT — 4D gated (study with 10 phases) | `4d_lung` | CT | IVR-LE | 168 | 88 | One of 10 gated phases in a study — tests phase navigation, temporal display | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.6834.5010.437908260188278566241499144676&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.6834.5010.166390784627393822782162347375) |
| R4 | MR — large DCE (time series) | `tcga_brca` | MR | EVR-LE | 2,000 | 1,058 | Dynamic contrast-enhanced, temporal dimension — tests 4D scroll | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.5382.4002.300985139957169488343422917033&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.5382.4002.659319113186130823015743142292) |
| R5 | MR — small DWI | `acrin_6698` | MR | EVR-LE | 25 | 3.6 | ADC map, b-values 0/100/600/800 — tests derived parametric map display | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.7695.4164.181609193230590889657798213902&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.7695.4164.141357882863385842422428486117) |
| R6 | PET | `acrin_flt_breast` | PT | EVR-LE | 35 | 1.4 | FLT-PET; tests SUV scaling, PET color LUT | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.7009.2401.119240798710936197902661466917&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.7009.2401.154307557743078185488964063763) |
| R7 | CR (single view) | `acrin_nsclc_fdg_pet` | CR | EVR-LE | 1 | 16 | Single large image, no volume | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.7009.2403.182164692508660719110608717013&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.7009.2403.163047059794023520412257934872) |
| R8 | DX (PA + lateral) | `acrin_nsclc_fdg_pet` | DX | EVR-LE | 4 | 33 | Chest PA & lateral in one series | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.7009.2403.257978324443722477660412488453&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.7009.2403.179077540374918512211170392831) |
| R9 | US (multi-frame) | `cptac_pda` | US | EVR-LE | 143 | 119 | Ultrasound cine — tests multi-frame playback | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.1078.3273.132220854463485495034769662271&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.1078.3273.151707753790818651875631573818) |
| R10 | NM | `covid_19_ny_sbu` | NM | EVR-LE | 32 | 0.6 | Lung TOMO MIP | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.99.1071.22244320722835368711826585397670&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.99.1071.11219839756713367372693394421970) |
| R11 | MG — DBT (3D tomosynthesis) | `victre` | MG | IVR-LE | 62 | 267 | Digital breast tomosynthesis slabs | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.2135.6389.195179036005551264342547556037&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.2135.6389.196860548330435160907816816497) |
| R12 | XA (angiography, multi-frame) | `cmb_aml` | XA | EVR-LE | 1 | 2.1 | Fluoroscopy loop — tests cine playback | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.1.20774752694271021889034517866183455410&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.1.17147871808539919675426641730310931959) |

### Transfer syntax coverage

| # | Transfer Syntax | UID | Collection | Modality | Instances | Notes | Viewer |
|---|---|---|---|---|---|---|---|
| R13 | Explicit VR Little Endian | `1.2.840.10008.1.2.1` | `rider_lung_pet_ct` | CT | 2,864 | Most common — see R1 | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.9328.50.17.160615776127383877801997638127387345147&initialSeriesInstanceUID=1.3.6.1.4.1.9328.50.17.3212576209713183142629060667025805170) |
| R14 | Implicit VR Little Endian | `1.2.840.10008.1.2` | `4d_lung` | CT | 142 | Legacy encoding, older scanners | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.6834.5010.465205689126985052184293614571&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.6834.5010.103521604337852189272990015277) |
| R15 | Explicit VR Big Endian (retired) | `1.2.840.10008.1.2.2` | `cptac_lscc` | CT | 240 | Retired from DICOM standard; decoders often miss this path | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.4801.5885.135432707744076194966456906497&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.4801.5885.148647290459489525080906012106) |
| R16 | JPEG Lossless FOP | `1.2.840.10008.1.2.4.70` | `midrc_ricord_1a` | CT | 111 | Lossless JPEG-coded — common in digital X-ray | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.2.826.0.1.3680043.10.474.419639.312580455409613733097488204614&initialSeriesInstanceUID=1.2.826.0.1.3680043.10.474.419639.108518937868403894887894311320) |
| R17 | JPEG 2000 Lossless | `1.2.840.10008.1.2.4.90` | `breast_cancer_screening_dbt` | MG | 1 | Most common for pathology; also present in MG | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.2.826.0.1.3680043.8.498.11387662677066579919319049302075478647&initialSeriesInstanceUID=1.2.826.0.1.3680043.8.498.12126807480439595619438700736679356780) |

The remaining transfer syntaxes (JPEG Baseline, JPEG 2000 Lossy, JPEG-LS Lossless, Mixed TS within series) occur exclusively or primarily in pathology data; see P2, P4, P8, and P3 respectively.

### Image-derived objects

R22 and R23 share a study with a source image series to test cross-series overlay rendering. P9 (Microscopy PR) shares a study with P5 (fluorescence WSI).

| # | Type | Collection | Modality | Transfer Syntax | Instances | Size (MB) | Notes | Viewer |
|---|---|---|---|---|---|---|---|---|
| R22 | Segmentation (MR-based) | `qin_prostate_repeatability` | SEG | EVR-LE | 1 | 4.0 | T2 axial prostate SEG; same study also contains T2, DWI, DCE, ADC MR series — tests SEG overlay on source | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.3671.4754.318227959935022390930294557376&initialSeriesInstanceUID=1.2.276.0.7230010.3.1.3.1426846371.7872.1513205171.131) |
| R23 | RT Structure Set | `4d_lung` | RTSTRUCT | IVR-LE | 1 | 2.1 | Same study as R3 CT — tests ROI contour rendering | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.6834.5010.465205689126985052184293614571&initialSeriesInstanceUID=2.25.5618076857306634880164728989441809423.1) |
| R24 | RT Dose | `pancreatic_ct_cbct_seg` | RTDOSE | IVR-LE | 1 | 97 | Large dose grid — tests dose colorwash rendering | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.21087345762211724523378497892240459677&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.245223985966061426102494958781347594184) |
| R25 | RT Plan | `vestibular_schwannoma_seg` | RTPLAN | IVR-LE | 1 | 0.02 | Beam geometry; not directly visualizable but must not crash | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.267424821384663813780850856506829388886&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.151251643407469240433833224247202025725) |
| R26 | Structured Report | `breast_diagnosis` | SR | EVR-LE | 1 | 0.006 | Tiny SR — viewer must render structured text, not crash on non-image | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.4792.2001.197465940191351169846602444317&initialSeriesInstanceUID=1.3.6.1.4.1.5962.1.1.0.0.1548529146.50549.1) |
| R27 | Spatial Registration | `cc_tumor_heterogeneity` | REG | IVR-LE | 1 | 0.02 | Registration object linking two series | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.122805535915539618236860659468790107523&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.172781701010682178700277761330502505852) |
| R28 | Real World Value Map | `ct_vs_pet_ventilation_imaging` | RWV | EVR-LE | 1 | 0.04 | Maps pixel values to physical quantities (e.g. HU to SUV) | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.297577087050970310787702792940607009472&initialSeriesInstanceUID=1.3.6.1.4.1.14519.5.2.1.272915270687549164634541166926177705239) |
| R29 | 3D Model | `prostate_mri_us_biopsy` | M3D | EVR-LE | 1 | 0.06 | STL-in-DICOM; tests graceful handling of non-image IOD | [View](https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.85548304921965658367726869399297351743&initialSeriesInstanceUID=1.3.6.1.4.1.5962.99.1.1930536128.799425412.1694147683520.3.0) |

---

## Pathology samples

**Viewer URL pattern:**
```
https://viewer.imaging.datacommons.cancer.gov/slim/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}
```

### WSI images

| # | Category | Collection | Transfer Syntax | Instances | Size (MB) | Max pixel matrix | Staining | Illumination | Notes | Viewer |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | WSI — huge, H&E | `rms_mutation_prediction` | EVR-LE + J2K-Lossless (mixed) | 7 | 28,222 | 151,391 × 92,994 | H&E | Brightfield | ~28 GB — extreme streaming performance test | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.16013537821180615487057817343052825441/series/1.3.6.1.4.1.5962.99.1.3772447802.2053489201.1687399660602.4.0) |
| P2 | WSI — large, May-Grünwald Giemsa, JPEG Baseline | `bonemarrowwsi_pediatricleukemia` | JPEG Baseline | 6 | 13,822 | 189,184 × 448,768 | May-Grünwald Giemsa | Brightfield | Bone marrow smear — extremely tall (non-square); JPEG Baseline decoder path | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/1.2.826.0.1.3680043.8.498.28269580482872773191191475373982309192/series/1.2.826.0.1.3680043.8.498.25601489258592255161343235858006543292) |
| P3 | WSI — medium, H&E, mixed JPEG | `cmb_crc` | EVR-LE + JPEG Baseline (mixed) | 7 | 2,999 | 109,559 × 81,897 | H&E | Brightfield | Mixed TS within series — pathological decoder edge case | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.92466204536656775610944344725709812714/series/1.3.6.1.4.1.5962.99.1.1272448538.1906062344.1714964432410.4.0) |
| P4 | WSI — small, H&E, JPEG2000 Lossy | `tcga_stad` | JPEG 2000 Lossy | 1 | 0.5 | 1,600 × 1,200 | H&E | Brightfield | Single pyramid level only — tests graceful no-zoom case; lossy J2K path | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.295549540896097797429979821304955099100/series/1.3.6.1.4.1.5962.99.1.2903309705.934477561.1639285882249.2.0) |
| P5 | WSI — fluorescence, 30-plex panel | `htan_hms` | EVR-LE | 216 | 67,120 | 24,920 × 26,094 | Multi-antibody (CD3, CD8, PD-1, Ki-67, …) | Epifluorescence | 30+ channels — tests channel selector, per-channel color assignment | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.219049900737444567890964056686598614067/series/1.3.6.1.4.1.5962.99.1.2343322182.1764456793.1655905763910.4.0) |
| P6 | WSI — multiplexed fluorescence, SARDANA | `htan_tnp_sardana` | J2K Lossless | 240 | 43,059 | 26,139 × 27,120 | Multi-antibody (Alpha-SMA, …) | Epifluorescence | ~40-channel fluorescence panel (240 instances ÷ 6 pyramid levels); same study also contains H&E WSI and PR — tests channel selector, per-channel color assignment | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.112849421593762410108114587383519700602/series/1.3.6.1.4.1.5962.99.1.331207435.2054329796.1752677896971.4.0) |

### Pathology image-derived objects

| # | Type | Collection | Modality | Transfer Syntax | Instances | Size (MB) | Notes | Viewer |
|---|---|---|---|---|---|---|---|---|
| P7 | Bulk annotation (ANN) | `tcga_luad` | ANN | EVR-LE | 1 | 0.88 | 3,567 nucleus polygon annotations on FFPE H&E lung adenocarcinoma WSI; references FFPE DX1 SM series in same study — tests ANN overlay rendering | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.138144370654209238925841881456148313713/series/1.2.826.0.1.3680043.10.511.3.75660021534863062578402046199665898) |
| P8 | Segmentation mask (SEG) | `rms_mutation_prediction` | SEG | JPEG-LS Lossless | 2 | 2.2 | Segmentation referencing WSI in same study; tests JPEG-LS decoder + mask overlay | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.20081751499427705056270169210442801676/series/1.2.826.0.1.3680043.10.511.3.25300727088905197494868158262574278) |
| P9 | Microscopy Presentation State (PR) | `htan_hms` | PR | EVR-LE | 3 | 0.22 | Same study as P5 fluorescence WSI — stored display parameters for slide viewing | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.219049900737444567890964056686598614067/series/1.2.826.0.1.3680043.10.511.3.51337276380398375498224774549772923) |
| P10 | Bulk annotation (ANN) — high zoom | `tcga_luad` | ANN | EVR-LE | — | — | Same study/series as P7, scrolled to high-res pyramid level — validates nucleus polygon overlays and tile decoding at full resolution | [View](https://viewer.imaging.datacommons.cancer.gov/slim/studies/2.25.138144370654209238925841881456148313713/series/1.2.826.0.1.3680043.10.511.3.75660021534863062578402046199665898?_zoom=5) |

---

## Coverage summary

| Dimension | Coverage |
|---|---|
| Modality | CT, MR, PT, CR, DX, MG, US, NM, XA, SM — 10 of 24 modalities in IDC |
| Image-derived type | SEG, RTSTRUCT, RTDOSE, RTPLAN, SR, REG, PR, RWV, M3D, ANN |
| Transfer syntax | IVR-LE, EVR-LE, EVR-BE (retired), JPEG Baseline, JPEG Lossless FOP, JPEG-LS Lossless, J2K Lossless, J2K Lossy, Mixed-within-series |
| Series size | 1 instance → 2,864 instances (radiology); 1 tile → 240 instances (pathology) |
| File size | 0.006 MB (SR) → 67,120 MB (fluorescence WSI) |
| WSI pixel matrix | 1,600 × 1,200 → 189,184 × 448,768 px |
| Temporal / 4D | 4D gated CT (`4d_lung`), DCE-MRI (`tcga_brca`) |
| Illumination (pathology) | Brightfield, Epifluorescence |
| Staining (pathology) | H&E, May-Grünwald Giemsa, 30-plex fluorescence panel (`htan_hms`), ~40-plex fluorescence panel (`htan_tnp_sardana`) |
| Linked series | SEG + source MR series same study (R22/`qin_prostate_repeatability`), RTSTRUCT + source CT same study (R23/R3), Microscopy PR + source WSI same study (P9/P5) |
| Encoding anomaly | Mixed TS within series (P3/cmb_crc, P1/rms_mutation_prediction) |
