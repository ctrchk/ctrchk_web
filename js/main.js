console.log('--- main.js 檔案已成功載入並開始執行！ ---');

/**
 * @file main.js
 * @description 網站全域腳本。【最終修正與結構優化版】
 */

document.addEventListener('DOMContentLoaded', function() {
    // ------------------- 所有程式碼都從這裡開始 -------------------

    // Reset body style on load
    document.body.style.opacity = '1';
    document.body.style.visibility = 'visible';

    // =========================================================================
    // 全站共用資料
    // =========================================================================
    const routes = [
        { id: '900', alias: "市區海濱線", start: "寶琳(新都城二期)", end: "調景嶺彩明", via: "景林邨、香港單車館、將軍澳海濱、調景嶺站", nature: "旅遊", time: 40, length: "5.5km", difficulty: 3, image: "images/900.jpg", description: "這是專為新手打造的「海濱專線」。全程半個多小時，少坡、風景優美，讓你在寶琳與調景嶺之間輕鬆穿梭，沿途還有補給點可供休息。", tags: ["將軍澳", "海濱專線", "寶琳調景嶺線", "新手必試", "風景優美", "少坡"], color: "#990000", gpx: [{ label: "往寶琳", file: "900寶琳.gpx" }, { label: "往調景嶺", file: "900調景嶺.gpx" }] },
        { id: '900A', alias: "寶調特快", start: "寶琳(新都城二期)", end: "調景嶺總站", via: "景林邨、寶順路、調景嶺站", nature: "混合", time: 20, length: "4.2km", difficulty: 1.5, image: "images/900A.jpg", description: "一條專為單車新手設計的輕鬆路線。取道寶順路專用單車徑來往寶琳與調景嶺，路況平坦，僅需 20 分鐘即可往返，是假日體驗單車樂的最佳選擇。", tags: ["將軍澳", "寶琳調景嶺線", "新手必試", "特快", "平坦", "通勤", "旅遊"], color: "#990000", gpx: [{ label: "往寶琳", file: "900A寶琳.gpx" }, { label: "往調景嶺", file: "900A調景嶺.gpx" }] },
        { id: '900S', alias: " ", start: "調景嶺總站", end: "寶琳消防局", via: "將軍澳海濱、寶琳北路", nature: "旅遊", time: 40, length: "5.0km", difficulty: 3.5, image: "images/900S.jpg", description: "適合黃昏時分騎行的單向快速路線。從將軍澳海濱直達寶琳東，全程可欣賞日落美景，僅需 40 分鐘即可完成。", tags: ["將軍澳", "單向線", "寶琳調景嶺線", "黃昏日落", "快速", "少坡", "風景優美"], color: "#990000", gpx: [{ label: "往寶琳", file: "900S寶琳.gpx" }] },
        { id: '901P', alias: "寶琳北快線", start: "寶琳(將軍澳村)", end: "將軍澳中心", via: "寶康路、將軍澳海濱、調景嶺站", nature: "混合", time: 40, length: "5.6km", difficulty: 3.5, image: "images/901P.jpg", description: "一條連接寶琳北、寶琳西與將軍澳市中心及調景嶺的特快路線。適合通勤與旅遊，讓你在城市間快速穿梭。", tags: ["將軍澳", "快速", "寶琳調景嶺線", "平坦", "通勤", "旅遊"], color: "#e06666", gpx: [{ label: "往寶琳", file: "901P寶琳.gpx" }, { label: "往調景嶺", file: "901P調景嶺.gpx" }] },
        { id: '910', alias: "坑口循環線", start: "坑口站", end: "坑口北、煜明苑", via: "坑口北、煜明苑", nature: "混合", time: 15, length: "3.1km", difficulty: 2, image: "images/910.jpg", description: "繞行坑口站及周邊外圍的雙循環線，適合通勤及旅遊。路線接駁地鐵站及巴士總站，人流較少且少坡，是進行單車訓練的理想選擇。", tags: ["將軍澳", "循環線", "坑口北專線", "少坡", "運動訓練", "連接地鐵站", "連接巴士總站", "人流較少", "通勤", "旅遊"], color: "#3c78d8", gpx: [{ label: "順時針", file: "910順時針.gpx" }, { label: "逆時針", file: "910逆時針.gpx" }] },
        { id: '914', alias: "景林快線", start: "寶琳(景林單車駅)", end: "坑口站", via: "", nature: "通勤", time: 4, length: "0.8km", difficulty: 0.5, image: "images/914.jpg", description: "專為通勤而設的景林專線。全日連接坑口站與景林邨，路況平坦且交通接駁便利，全程僅需 4 分鐘，是節省通勤時間的首選。", tags: ["將軍澳", "通勤專線", "平坦", "連接地鐵站", "連接巴士總站", "少坡"], color: "#073763", gpx: [{ label: "往寶琳", file: "914寶琳.gpx" }, { label: "往坑口", file: "914坑口.gpx" }] },
        { id: '914B', alias: " ", start: "寶琳(新都城二期)", end: "將軍澳醫院", via: "景林邨、坑口站、厚德邨", nature: "旅遊", time: 12, length: "3.0km", difficulty: 2, image: "images/914B.jpg", description: "一條連接寶琳新都城、坑口站與將軍澳醫院的旅遊路線。路況平坦，沿途接駁地鐵與巴士總站，提供便捷的醫院專線服務。", tags: ["將軍澳", "坑口北專線", "平坦", "醫院專線", "連接地鐵站", "連接巴士總站", "少坡"], color: "#073763", gpx: [{ label: "往寶琳", file: "914B寶琳.gpx" }, { label: "往醫院", file: "914B醫院.gpx" }] },
        { id: '914H', alias: "醫院特快", start: "坑口站", end: "將軍澳醫院", via: "", nature: "混合", time: 6, length: "1.0km", difficulty: 1, image: "images/914H.jpg", description: "全日特快連接坑口站與將軍澳醫院的通勤與旅遊混合路線。路況平坦、人流較少，為你提供一條快速又寧靜的醫院專線。", tags: ["將軍澳", "坑口北專線", "醫院專線", "連接地鐵站", "少坡", "人流較少", "通勤", "旅遊"], color: "#073763", gpx: [{ label: "往坑口", file: "914H坑口.gpx" }, { label: "往醫院", file: "914H醫院.gpx" }] },
        { id: '920', alias: "尚德專線", start: "維景灣畔", end: "寶琳站", via: "調景嶺學校區、將軍澳中心、尚德、坑口站、寶琳學校區", nature: "旅遊", time: 30, length: "4.6km", difficulty: 3, image: "images/920.jpg", description: "深入將軍澳各核心區的旅遊路線。同時途經調景嶺、坑口及寶琳站，讓你盡情探索將軍澳。", tags: ["將軍澳", "旅遊專線", "少坡", "維景灣畔專線", "連接地鐵站", "學校線"], color: "#660000", gpx: [{ label: "往寶琳", file: "920寶琳.gpx" }, { label: "往調景嶺", file: "920調景嶺.gpx" }] },
        { id: '920X', alias: "維景特快", start: "維景灣畔", end: "寶琳站", via: "彩明苑", nature: "混合", time: 20, length: "3.5km", difficulty: 2.5, image: "images/920X.jpg", description: "一條從維景灣畔及彩明直達寶琳站的特快路線。相比 920，此路線無需繞經將軍澳各區，路況平坦，適合通勤及單車訓練。", tags: ["將軍澳", "平坦", "特快", "運動訓練", "新手必試", "維景灣畔專線", "連接地鐵站", "通勤", "旅遊"], color: "#660000", gpx: [{ label: "往寶琳", file: "920X寶琳.gpx" }, { label: "往調景嶺", file: "920X調景嶺.gpx" }] },
        { id: '923', alias: "市中心循環線", start: "調景嶺總站", end: null, via: "單車館公園、調景嶺碼頭、將軍澳海濱、天晉、入境事務大樓", nature: "混合", time: 40, length: "5.6km", difficulty: 3.5, image: "images/923.jpg", description: "連接調景嶺、尚德、單車館及將軍澳市中心的平坦循環線。交通接駁便利，適合通勤與休閒的混合用途。", tags: ["將軍澳", "循環", "平坦", "連接地鐵站", "通勤", "旅遊"], color: "#ff0000", gpx: [{ label: "順時針", file: "923順時針.gpx" }, { label: "逆時針", file: "923逆時針.gpx" }] },
        { id: '928', alias: "海濱特快", start: "寶琳站", end: "將軍澳(雍明)", via: "靈實、調景嶺、將軍澳海濱", nature: "混合", time: "40(往將軍澳)/30(往寶琳)", length: "6.0km(往將軍澳)/4.8km(往寶琳)", difficulty: 3.5, image: "images/928.jpg", description: "專為新手打造的海濱特快路線。全程少坡、風景優美，連接寶琳市中心、調景嶺及將軍澳海濱，沿途可連接渡輪，體驗多樣交通樂趣。", tags: ["將軍澳", "寶琳調景嶺線", "新手必試", "少坡", "海濱專線", "特快", "風景優美", "連接地鐵站", "接駁渡輪", "通勤", "旅遊"], color: "#783f04", gpx: [{ label: "往寶琳", file: "928寶琳.gpx" }, { label: "往將軍澳", file: "928將軍澳.gpx" }] },
        { id: '929', alias: "坑口快速", start: "坑口站", end: "調景嶺總站", via: "坑口北、將軍澳海濱、將軍澳站、調景嶺站", nature: "混合", time: 35, length: "6.2km", difficulty: 3, image: "images/929.jpg", description: "坑口北專線，路況平坦，連接坑口各區、將軍澳市中心及調景嶺。這條多用途路線非常適合單車新手體驗。", tags: ["將軍澳", "新手必試", "平坦", "坑口北專線", "快速", "接駁渡輪", "通勤", "旅遊"], color: "#f1c232", gpx: [{ label: "往坑口", file: "929坑口.gpx" }, { label: "往調景嶺", file: "929調景嶺.gpx" }] },
        { id: '932', alias: "坑康線", start: "坑口站", end: "將軍澳創新園", via: "坑口北、北橋、清水灣半島、康城海濱、日出康城", nature: "混合", time: 45, length: "8.1km", difficulty: 4, image: "images/932.jpg", description: "連接坑口、清水灣半島、康城及創新園的長途特快路線。路況少坡，沿著海濱騎行，是挑戰長途的絕佳選擇。", tags: ["將軍澳", "長途", "少坡", "清水灣半島專線", "海濱專線", "風景優美", "坑口北專線", "快速", "創新園路線", "通勤", "旅遊"], color: "#ff00ff", gpx: [{ label: "往創新園", file: "932創新園.gpx" }, { label: "往坑口", file: "932坑口.gpx" }] },
        { id: '935', alias: "南北專線", start: "寶琳(將軍澳村)", end: "將軍澳創新園", via: "寶康路、北橋、康城海濱、日出康城", nature: "旅遊", time: 50, length: "9.6km", difficulty: 4.5, image: "images/935.jpg", description: "一條適合旅遊與運動訓練的長途路線。由單車徑最南端的創新園出發，沿著康城海濱及寶康路一路向北，途經將軍澳北，前往單車徑最北端的將軍澳村，享受開闊的騎行體驗。", tags: ["將軍澳", "旅遊專線", "長途", "海濱專線", "運動訓練", "南北三寶", "創新園路線"], color: "#38761d", gpx: [{ label: "往寶琳", file: "935寶琳.gpx" }, { label: "往創新園", file: "935創新園.gpx" }] },
        { id: 'X935', alias: "南北特快", start: "寶琳(將軍澳村)", end: "將軍澳創新園", via: "寶琳北路、日出康城", nature: "旅遊", time: 40, length: "8.0km", difficulty: 4, image: "images/X935.jpg", description: "935的特快版本，無需跟從主線的迂迴走線，而是更加直接。此路線為長途旅遊線，路況優越，讓你能在更短時間內穿梭將軍澳南北。", tags: ["將軍澳", "旅遊專線", "特快", "長途", "海濱專線", "創新園路線", "南北三寶"], color: "#38761d", gpx: [{ label: "往宝琳", file: "X935寶琳.gpx" }, { label: "往創新園", file: "X935創新園.gpx" }] },
        { id: '939', alias: "創新園專線", start: "峻瀅", end: "將軍澳創新園", via: "環保大道", nature: "旅遊", time: 30, length: "2.5km(單向)", difficulty: 3.5, image: "images/939.jpg", description: "一條連接峻瀅及將軍澳創新園的路線。非常適合單車新手體驗，享受周邊的休閒時光，人流極少。", tags: ["將軍澳", "旅遊專線", "平坦", "新手必試", "創新園路線", "人流較少", "循環"], color: "#741b47", gpx: [{ label: "來回", file: "939循環.gpx" }] },
        { id: '939M', alias: " ", start: "康城站", end: "將軍澳創新園", via: "環保大道", nature: "通勤", time: 35, length: "2.9km(單向)", difficulty: 3.5, image: "images/939M.jpg", description: "連接康城站及創新園的特快通勤路線。路面平坦，專為通勤族設計，讓你可以由創新園快速轉乘地鐵。", tags: ["將軍澳", "通勤專線", "平坦", "快速", "創新園路線", "連接地鐵站", "人流較少", "循環"], color: "#741b47", gpx: [{ label: "往康城", file: "939M康城.gpx" }, { label: "往創新園", file: "939M循環.gpx" }] },
        { id: '955', alias: "寶琳循環線", start: "寶琳(新都城二期)", end: null, via: "寶順路、寶康路、寶琳北路", nature: "普通", time: 20, length: "4.1km", difficulty: 2, image: "images/955.jpg", description: "連接新都城二期（寶琳站）及寶琳各區的循環線。同時適合通勤與旅遊，及方便接駁其他交通。", tags: ["將軍澳", "平坦", "循環", "連接地鐵站", "連接巴士總站"], color: "#dd7e6b", gpx: [{ label: "順時針", file: "955順時針.gpx" }, { label: "逆時針", file: "955逆時針.gpx" }] },
        { id: '955A', alias: "將軍澳村專線", start: "將軍澳村", end: "新都城二期", via: "寶琳北路", nature: "通勤", time: 6, length: "1.2km", difficulty: 1, image: "images/955A.jpg", description: "一條從將軍澳村直達新都城二期（寶琳站）的特快通勤路線。路況少坡，交通接駁便利，全程僅需 6 分鐘。", tags: ["將軍澳", "通勤專線", "快速", "少坡", "連接地鐵站"], color: "#dd7e6b", gpx: [{ label: "單向", file: "955A將軍澳村.gpx" }] },
        { id: '955H', alias: "靈實專線", start: "寶琳站", end: "靈實醫院(九巴車廠)", via: "", nature: "混合", time: "20(來回)", length: "3.1km(來回)", difficulty: 1.5, image: "images/955H.jpg", description: "連接寶琳站與靈實醫院的平坦特快路線。適合通勤與旅遊，為需要前往醫院的用戶提供便利。", tags: ["將軍澳", "平坦", "醫院專線", "連接地鐵站", "通勤", "旅遊"], color: "#dd7e6b", gpx: [{ label: "來回", file: "955H循環.gpx" }] },
        { id: '960', alias: "終極旅遊線", start: "將軍澳村", end: "將軍澳創新園", via: "寶琳北路、寶順路、調景嶺站、將軍澳跨灣大橋、日出康城", nature: "旅遊", time: 80, length: "12.8km", difficulty: 5, image: "images/960.jpg", description: "終極旅遊線，繞經將軍澳大部分地區。由寶琳開出，途經坑口、尚德、調景嶺及將軍澳西後經過將軍澳跨灣大橋直達日出康城，最後前往將軍澳創新園，多坡路段適合專業單車訓練，讓你盡覽整個將軍澳地區風光。", tags: ["將軍澳", "旅遊專線", "運動訓練", "多坡", "長途", "大橋特快", "南北三寶", "創新園路線", "風景優美", "挑戰"], color: "#76a5af", gpx: [{ label: "往創新園", file: "960創新園.gpx" }, { label: "往寶琳", file: "960寶琳.gpx" }] },
        { id: '961', alias: " ", start: "維景灣畔", end: "康城西", via: "調景嶺站、唐賢街、至善街、怡明邨、北橋、康城海濱", nature: "混合", time: 30, length: "4.7km", difficulty: 3, image: "images/961.jpg", description: "一條連接康城與調景嶺維景灣畔的快速路線。路況少坡，讓康城居民可以方便地前往將軍澳中部。", tags: ["將軍澳", "少坡", "維景灣畔專線", "風景優美", "通勤", "旅遊"], color: "#93c47d", gpx: [{ label: "往康城", file: "961康城.gpx" }, { label: "往調景嶺", file: "961調景嶺.gpx" }] },
        { id: '961P', alias: " ", start: "康城西", end: "將軍澳中心", via: "康城海濱、南橋、將軍澳海濱", nature: "旅遊", time: 20, length: "3.0km", difficulty: 3, image: "images/961P.jpg", description: "只於黃昏前後開放的單向騎行路線。從日出康城近大橋出發，途經南橋及將軍澳南梯台前往將軍澳中心，沿著海濱欣賞日落，最後前往將軍澳中心商場，亦可接駁渡輪前往。", tags: ["將軍澳", "旅遊專線", "黃昏日落", "單向", "海濱專線", "接駁渡輪", "快速"], color: "#93c47d", gpx: [{ label: "單向", file: "961P將軍澳.gpx" }] },
        { id: '962', alias: "創新園市中心線", start: "將軍澳創新園", end: null, via: "調景嶺站、將軍澳(入境事務大樓/地鐵站/唐賢街)", nature: "混合", time: 60, length: "9.4km", difficulty: 4, image: "images/962.jpg", description: "將軍澳市中心前往將軍澳創新園的最快的方法。途經將軍澳跨灣大橋，適合通勤族快速抵達。", tags: ["將軍澳", "多坡", "特快", "大橋特快", "創新園路線", "人流較少", "通勤", "旅遊"], color: "#c27ba0", gpx: [{ label: "往返", file: "962.gpx" }] },
        { id: '962A', alias: "大橋循環線", start: "峻瀅", end: null, via: "將軍澳(入境事務大樓/地鐵站/海濱)", nature: "混合", time: 50, length: "9.4km", difficulty: 4, image: "images/962A.jpg", description: "循環來往日出康城/峻瀅及將軍澳市中心或海濱的特快路線。路線設計，讓你可以同時體驗將軍澳跨灣大橋及將軍澳海濱的優美風景。", tags: ["將軍澳", "循環", "多坡", "特快", "海濱專線", "大橋特快", "接駁渡輪", "風景優美", "通勤", "旅遊"], color: "#c27ba0", gpx: [{ label: "單循環", file: "962A循環.gpx" }] },
        { id: '962P', alias: "創新園通勤專線", start: "將軍澳創新園", end: "將軍澳站", via: "將軍澳南", nature: "通勤", time: 30, length: "5.7km", difficulty: 3.5, image: "images/962P.jpg", description: "平日下午專為前往將軍澳創新園通勤的將軍澳市中心居民回家設計的單向特快路線。從創新園直達將軍澳市區，途經大橋並不途經調景嶺，快速便捷。", tags: ["將軍澳", "通勤專線", "單向", "多坡", "特快", "大橋特快", "創新園路線"], color: "#c27ba0", gpx: [{ label: "單向", file: "962P將軍澳.gpx" }] },
        { id: '962X', alias: "入境通勤專線", start: "峻瀅", end: "將軍澳站", via: "康城、將軍澳跨灣大橋、將軍澳入境事務大樓", nature: "通勤", time: 20, length: "4.3km", difficulty: 3.5, image: "images/962X.jpg", description: "平日上午專為前往將軍澳入境事務大樓或將軍澳市中心辦公的康城居民設計的特快路線。從康城直達將軍澳入境事務大樓及將軍澳站，途經將軍澳跨灣大橋，省時高效。", tags: ["將軍澳", "通勤專線", "康城專線", "單向", "多坡", "特快", "大橋特快"], color: "#c27ba0", gpx: [{ label: "單向", file: "962X康城.gpx" }] },
        { id: '966', alias: "維景灣畔線", start: "維景灣畔", end: "康城站", via: "調景嶺站、將軍澳跨灣大橋", nature: "混合", time: 18, length: "3.2km", difficulty: 3.5, image: "images/966.jpg", description: "連接康城站及調景嶺站/維景灣畔的特快路線。途經將軍澳跨灣大橋大橋，特快往來，同時適合通勤與旅遊。", tags: ["將軍澳", "多坡", "大橋特快", "康城專線", "維景灣畔專線", "通勤", "旅遊"], color: "#ff9900", gpx: [{ label: "往康城", file: "966康城.gpx" }, { label: "往調景嶺", file: "966調景嶺.gpx" }] },
        { id: '966A', alias: "康城通勤A線", start: "康城站", end: "調景嶺站", via: "將軍澳跨灣大橋", nature: "通勤", time: 15, length: "2.9km", difficulty: 3, image: "images/966A.jpg", description: "一條連接康城站(日出康城)與調景嶺站的特快通勤路線。取道將軍澳跨灣大橋直接連接兩地，方便康城居民前往調景嶺或快速轉乘地鐵。", tags: ["將軍澳", "通勤專線", "多坡", "大橋特快", "連接地鐵站", "連接巴士總站", "康城專線"], color: "#ff9900", gpx: [{ label: "往康城", file: "966A康城.gpx" }, { label: "往調景嶺", file: "966A調景嶺.gpx" }] },
        { id: '966B', alias: "康城通勤B線", start: "康城領都", end: "調景嶺站", via: "將軍澳跨灣大橋", nature: "通勤", time: 18, length: "3.3km", difficulty: 3.5, image: "images/966B.jpg", description: "一條連接日出康城領都與調景嶺站的特快通勤路線。取道將軍澳跨灣大橋直接連接兩地，方便康城居民前往調景嶺或快速轉乘地鐵。", tags: ["將軍澳", "通勤專線", "多坡", "大橋特快", "連接地鐵站", "連接巴士總站", "康城專線"], color: "#ff9900", gpx: [{ label: "往康城", file: "966B康城.gpx" }, { label: "往調景嶺", file: "966B調景嶺.gpx" }] },
        { id: '966C', alias: "康城通勤C線", start: "峻瀅", end: "調景嶺站", via: "日出康城、將軍澳跨灣大橋", nature: "通勤", time: 22, length: "3.8km", difficulty: 4, image: "images/966C.jpg", description: "一條連接峻瀅/日出康城與調景嶺站的特快通勤路線。取道將軍澳跨灣大橋直接連接兩地，方便峻瀅及康城居民前往調景嶺或快速轉乘地鐵。", tags: ["將軍澳", "通勤專線", "多坡", "大橋特快", "連接地鐵站", "連接巴士總站", "康城專線"], color: "#ff9900", gpx: [{ label: "往康城", file: "966C康城.gpx" }, { label: "往調景嶺", file: "966C調景嶺.gpx" }] },
        { id: '966T', alias: "大橋旅遊線", start: "調景嶺站", end: "康城站", via: "將軍澳跨灣大橋", nature: "旅遊", time: 16, length: "3.0km", difficulty: 3, image: "images/966T.jpg", description: "專為遊覽觀光設計的大橋特快路線。連接康城站與調景嶺站，適合單車新手挑戰自我，欣賞大橋景色。", tags: ["將軍澳", "旅遊專線", "多坡", "大橋特快", "新手必試", "連接地鐵站"], color: "#ff9900", gpx: [{ label: "往康城", file: "966T康城.gpx" }, { label: "往調景嶺", file: "966T調景嶺.gpx" }] },
        { id: 'S90', alias: "康城海濱線", start: "清水灣半島", end: null, via: "康城海濱", nature: "通勤", time: 20, length: "3.5km(來回)", difficulty: 2.5, image: "images/S90.jpg", description: "清水灣半島專線，連接將軍澳站。路況少坡，適合通勤，為居民提供一條快速的地鐵接駁選擇。", tags: ["將軍澳", "通勤專線", "少坡", "特快", "清水灣半島專線", "連接地鐵站"], color: "#00ff00", textColor: "black", gpx: [{ label: "來回", file: "S90康城循環.gpx" }] },
        { id: 'S91', alias: "清半接駁線", start: "清水灣半島", end: "將軍澳站", via: "北橋、怡明邨", nature: "混合", time: 6, length: "1.1km", difficulty: 1, image: "images/S91.jpg", description: "循環來往清水灣半島與康城站的循環線。適合清水灣半島居民通勤，也適合體驗康城海濱，道路平坦，讓你輕鬆騎行，探索康城風光。", tags: ["將軍澳", "平坦", "循環", "清水灣半島專線", "通勤", "旅遊"], color: "#ffff00", textColor: "black", gpx: [{ label: "往清水灣半島", file: "S91清水灣半島.gpx" }, { label: "往調景嶺", file: "S91調景嶺.gpx" }] },
        { id: 'ST01', alias: " ", start: "沙田站", end: "第一城", via: "城門河畔", nature: "通勤", time: "待定", length: "待定", difficulty: "待定", image: "images/st_coming_soon.jpg", description: "規劃中的沙田路線，敬請期待！", tags: ["沙田區", "通勤"], color: "#333", link: "/coming_soon.html", gpx: [] }
    ];


    // =========================================================================
// 全站共用函式
// =========================================================================

/**
 * 根據評分產生星星圖示 HTML
 * @param {number} rating - 評分數字 (例如 3.5)
 * @returns {string} - 回傳包含 Font Awesome 圖示的 HTML 字串
 */
function generateStarRating(rating) {
    const totalStars = 5;
    let starsHtml = '<span class="star-rating">';

    // 計算實心星星的數量
    const fullStars = Math.floor(rating);
    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="fas fa-star"></i>';
    }

    // 判斷是否有半顆星
    if (rating % 1 >= 0.5) {
        starsHtml += '<i class="fas fa-star-half-stroke"></i>';
    }

    // 計算空心星星的數量
    const emptyStars = totalStars - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="far fa-star"></i>';
    }

    starsHtml += '</span>';
    return starsHtml;
}
    
    // =========================================================================
    // 全站共用函式
    // =========================================================================

    /**
     * 初始化所有帶有 .animated-element 的元素，當它們進入可視範圍時顯示。
     */
    function initAnimatedElements() {
        const animatedElements = document.querySelectorAll('.animated-element');
        if (animatedElements.length === 0) return;

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            animatedElements.forEach(el => observer.observe(el));
        } else {
            // 如果瀏覽器不支援，就立即顯示所有元素
            animatedElements.forEach(el => el.classList.add('is-visible'));
        }
    }

    // =========================================================================
    // 頁面專屬初始化函式
    // =========================================================================

function initHomePage() {
    const container = document.getElementById('routes-preview-container');
    if (!container) return;

    // 1. 在這裡定義你想要精選的路線 ID
    const featuredRouteIds = ['900', '960', '966T'];

    // 2. 從 `routes` 總列表中，根據 ID 找出對應的路線資料
    const routesToShow = featuredRouteIds.map(id => routes.find(route => route.id === id));

    // 3. 清空容器，準備放入我們指定的路線
    container.innerHTML = '';

    // 4. 根據找到的路線資料，建立卡片
    routesToShow.forEach(route => {
        if (route) { // 確保路線真的被找到了
            const card = document.createElement('div');
            card.className = 'route-card';
            card.innerHTML = `
    <a href="/route_detail.html?id=${route.id}">
        <img src="${route.image}" alt="${route.alias || route.id}">
        <div class="route-card-title">
            <h3>
                <span class="route-card-id" style="background-color: ${route.color}; color: ${route.textColor || 'white'}">
                    ${route.id}
                </span>
                ${route.alias || '(無別稱)'}
            </h3>
        </div>
    </a>
`;
            container.appendChild(card);
        }
    });
}

// 在 main.js 中，找到並用下面的版本替換掉整個 initRoutesPage 函式

// 在 main.js 中，找到並用下面的版本替換掉整個 initRoutesPage 函式

// 在 main.js 中，找到 initRoutesPage 函式，並用下面的版本完整取代它

// 在 main.js 中，找到並用這個最終版本，完整取代舊的 initRoutesPage 函式

// 請用這段完整、正確的程式碼，取代你 js/main.js 中舊的 initRoutesPage 函式

function initRoutesPage() {
    const allRoutesContainer = document.getElementById('all-routes-container');
    const heroSearchInput = document.getElementById('hero-search-input');

    // 如果頁面缺少必要元素，就停止執行以避免錯誤
    if (!allRoutesContainer || !heroSearchInput) return;

    const filterCategories = {
        "路線區域": ["將軍澳", "沙田區"],
        "路線類別": ["通勤", "旅遊", "單向", "循環", "快速", "特快", "長途"],
        "路線特色": ["新手必試", "風景優美", "黃昏日落", "挑戰", "運動訓練", "平坦", "少坡", "多坡"],
        "路線稱號": ["海濱專線", "坑口北專線", "維景灣畔專線", "清水灣半島專線", "康城專線", "寶琳調景嶺線", "學校線", "創新園路線", "南北三寶"],
        "接駁交通": ["連接地鐵站", "連接巴士總站", "接駁渡輪"]
    };
    const tagMap = { "單向": "單向線", "循環": "循環線" };
    let activeFilters = {};
    let searchTerm = '';

    // --- 1. 建立篩選器 UI (只有按鈕) ---
    const filterControls = document.createElement('div');
    filterControls.className = 'filter-controls';
    
    for (const category in filterCategories) {
        activeFilters[category] = [];
        const container = document.createElement('div');
        container.className = 'filter-dropdown-container';
        const button = document.createElement('button');
        button.className = 'filter-category-button';
        button.textContent = category;
        const menu = document.createElement('div');
        menu.className = 'filter-dropdown-menu';
        filterCategories[category].forEach(tag => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = tag;
            checkbox.dataset.category = category; // 【重要修正】補上這一行
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${tag}`));
            menu.appendChild(label);
        });
        container.appendChild(button);
        container.appendChild(menu);
        filterControls.appendChild(container);
    }
    
    const filtersContainer = document.createElement('div');
    filtersContainer.className = 'filters-container';
    filtersContainer.appendChild(filterControls);
    allRoutesContainer.before(filtersContainer);

    // --- 2. 設定事件監聽 ---
    heroSearchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        applyFilters();
    });

    document.querySelectorAll('.filter-category-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentMenu = button.nextElementSibling;
            document.querySelectorAll('.filter-dropdown-menu.show').forEach(menu => {
                if (menu !== currentMenu) menu.classList.remove('show');
            });
            currentMenu.classList.toggle('show');
        });
    });

    window.addEventListener('click', () => {
        document.querySelectorAll('.filter-dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    });

    document.querySelectorAll('.filter-dropdown-menu input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const category = checkbox.dataset.category;
            const value = checkbox.value;
            if (checkbox.checked) {
                if (!activeFilters[category].includes(value)) activeFilters[category].push(value);
            } else {
                activeFilters[category] = activeFilters[category].filter(item => item !== value);
            }
            applyFilters();
        });
    });

    // --- 3. 核心邏輯函式 ---
    function applyFilters() {
        let filteredByTags = [...routes];
        const hasActiveTagFilters = Object.values(activeFilters).some(tags => tags.length > 0);

        if (hasActiveTagFilters) {
            filteredByTags = filteredByTags.filter(route => {
                return Object.entries(activeFilters).every(([category, selectedTags]) => {
                    if (selectedTags.length === 0) return true;
                    return selectedTags.some(tag => {
                        const actualTag = tagMap[tag] || tag;
                        if ((tag === "通勤" || tag === "旅遊") && route.nature === "混合") return true;
                        return route.tags.includes(actualTag);
                    });
                });
            });
        }
        
        let finalFilteredRoutes = filteredByTags;
        if (searchTerm.trim() !== '') {
            finalFilteredRoutes = filteredByTags.filter(route => {
                const searchFields = [
                    route.id, route.alias, route.start, route.end || '', route.via || ''
                ].join(' ').toLowerCase();
                return searchFields.includes(searchTerm);
            });
        }
        renderRoutes(finalFilteredRoutes);
    }

    function renderRoutes(routesToRender) {
        allRoutesContainer.innerHTML = '';
        if (routesToRender.length > 0) {
            routesToRender.forEach(route => {
                const card = document.createElement('div');
                card.className = 'route-card-full animated-element';
                const link = route.link || `/route_detail.html?id=${route.id}`;
                card.innerHTML = `
                    <a href="${link}" class="${route.id.startsWith('ST') ? 'disabled-link' : ''}">
                        <div class="route-card-header">
                            <span class="route-id-code" style="background-color: ${route.color}; color: ${route.textColor || 'white'};">${route.id}</span>
                            <h3 class="route-alias">${route.alias || '(無別稱)'}</h3>
                        </div>
                        <div class="route-card-content">
                            <p><strong>起點:</strong> ${route.start}</p>
                            <p><strong>終點:</strong> ${route.end || '(循環線)'}</p>
                        </div>
                    </a>
                `;
                allRoutesContainer.appendChild(card);
            });
        } else {
            allRoutesContainer.innerHTML = '<p style="text-align: center; font-size: 1.2em; color: #555;">找不到符合條件的路線。</p>';
        }
        initAnimatedElements();
    }
    
    // --- 4. 首次載入頁面時，渲染所有路線 ---
    renderRoutes(routes);
}
    
    function initRouteDetailPage() {
        const routeDetailContainer = document.getElementById('route-detail-container');
        if (!routeDetailContainer) return;

        const urlParams = new URLSearchParams(window.location.search);
        const routeId = urlParams.get('id');

        if (routeId) {
            const route = routes.find(r => r.id === routeId);
            if (route) {
                document.title = `香港城市運輸單車 - ${route.alias || route.id}`;
                let gpxButtonsHtml = '';
                if (route.gpx && route.gpx.length > 0) {
                    gpxButtonsHtml = `
                        <div class="gpx-download-container">
                            ${route.gpx.map(gpxFile => `
                                <a href="gpx/${gpxFile.file}" download="${gpxFile.file}" class="gpx-download-button">
                                    ${gpxFile.label} <i class="fas fa-download"></i>
                                </a>
                            `).join('')}
                        </div>
                    `;
                }
                routeDetailContainer.innerHTML = `
                    <div class="route-hero animated-element" style="background-color: ${route.color}; color: ${route.textColor || 'white'};">
                        <h1 class="route-hero-title">${route.alias || '路線詳情'}</h1>
                        <p class="route-id-text">路線編號: ${route.id}</p>
                    </div>
                    <div class="route-detail-grid animated-element">
                        <div class="route-image-container">
                            <img src="${route.image}" alt="${route.alias || route.id}" class="route-detail-image">
                            ${gpxButtonsHtml}
                        </div>
                        <div class="route-detail-info">
                            <p class="route-description">${route.description}</p>
                            <div class="route-stats">
                                <div><strong>起點:</strong> ${route.start}</div>
                                <div><strong>終點:</strong> ${route.end || '循環線'}</div>
                                <div><strong>主要途經:</strong> ${route.via || '無'}</div>
                                <div><strong>性質:</strong> ${route.nature}</div>
                                <div><strong>預計全程行車時間:</strong> ${route.time}分鐘</div>
                                <div><strong>路線全長:</strong> ${route.length}</div>
                                <div><strong>難度:</strong> ${generateStarRating(route.difficulty)} (${route.difficulty}/5)</div>
                            </div>
                            <div class="route-tags-container">
                                <strong>標籤:</strong>
                                <div class="route-tags">
                                    ${route.tags.map(tag => `<span class="route-tag">${tag}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                initAnimatedElements();
            } else {
                routeDetailContainer.innerHTML = '<p>找不到指定的路線。</p>';
            }
        }
    }

    // =========================================================================
    // 執行初始化
    // =========================================================================
    if (document.getElementById('routes-preview-container')) {
        initHomePage();
    }
    if (document.getElementById('all-routes-container')) {
        initRoutesPage();
    }
    if (document.getElementById('route-detail-container')) {
        initRouteDetailPage();
    }
    
    // 【關鍵修正】確保動畫函式在所有頁面都會被執行
    initAnimatedElements();


    // =========================================================================
    // 其他全域腳本 (Dark mode, Modal 等)
    // =========================================================================

    // Dark mode support
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (event.matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    });

    // Modal functionality
    const modal = document.getElementById('notificationModal');

    function closeNotification() {
        if (!modal) return; // 安全檢查
        const modalContent = modal.querySelector('.bg-white, .bg-gray-800');
        modalContent.classList.remove('modal-enter');
        modalContent.classList.add('modal-exit');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 200);
    }

    function showNotification() {
        if (!modal) return; // 安全檢查
        modal.style.display = 'flex';
        const modalContent = modal.querySelector('.bg-white, .bg-gray-800');
        modalContent.classList.remove('modal-exit');
        modalContent.classList.add('modal-enter');
    }

    function initializeNotificationModal() {
        if (!modal) return; // 如果頁面沒有 modal 元素，就直接返回
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeNotification();
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                closeNotification();
            }
        });
        window.addEventListener('load', function() {
            setTimeout(() => {
                showNotification();
            }, 500);
        });
    }

    initializeNotificationModal();

    const NotificationManager = {
        showSuccess: function(title, message) { console.log('Success notification:', title, message); },
        showWarning: function(title, message) { console.log('Warning notification:', title, message); },
        showError: function(title, message) { console.log('Error notification:', title, message); },
        setDismissed: function(notificationId) { console.log(`Notification ${notificationId} dismissed`); },
        isDismissed: function(notificationId) { return false; }
    };

    // Export functions for global access (if needed)
    window.closeNotification = closeNotification;
    window.showNotification = showNotification;
    window.NotificationManager = NotificationManager;

    // ------------------- 所有程式碼都在這裡結束 -------------------
});
