# 第3回　人口統計と指数成長モデル

### 今回の位置付け

1. 現象の理解
2. 仮定の設定
3. 数理モデルの構築
4. 数値シミュレーション
5. <span style="color:red">データとの比較</span>
6. パラメタ推定
7. モデルの検証と改善

- 第1回：日本の人口を題材に，現象に対する仮定を数式で記述した．
- 第2回：Euler法と`solve_ivp`で初期値問題を解き，解析解との誤差を比較した．
- 第3回：人口統計の出典・単位・集計範囲を確認し，指数成長モデルを観測値と比較する．
- データとの比較：数値解が微分方程式の解を近似する精度と，モデルが観測値を説明する精度を区別する．
- パラメタ推定：観測値からモデルの係数を決めること．今回は2時点法と対数線形の最小二乗法を扱う．

### 到達目標

- データの確認：出典・単位・期間・欠損値・集計上の注意点を記録できる．
- モデルの構築：人口の変化率が現在の人口に比例するという仮定から $N'=rN$ を導き，各項の意味と単位を説明できる．
- 既習内容の利用：第2回の解析解を用いて，人口モデルの計算値を求められる．
- パラメタ推定：2時点法と対数線形の最小二乗法で $r$ を求め，使用するデータと初期値の扱いの違いを説明できる．
- 適合度の評価：観測値とモデルの比較図・残差・平均二乗誤差から，推定期間内外の違いを説明できる．
- 外挿：推定期間外への予測について，仮定の適用範囲と限界を説明できる．

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 作業環境の準備（演習0） | 10分 |
| 2 | 第1・2回の復習（演習1），人口モデルの仮定と各項の意味 | 25分 |
| 3 | 解析解を用いた2時点法と対数線形法による推定 | 20分 |
| 4 | 観測値との重ね合わせ，残差，期間を変えた比較，外挿（演習2〜4） | 35分 |
| 5 | 外れる理由の共有，まとめ，課題の説明 | 15分 |

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第3回の作業フォルダを作成せよ．データフォルダは第1回のものをそのまま使う．

```bash
mkdir -p ~/applied_programming_ii/03
cd ~/applied_programming_ii/03
mkdir -p notebooks reports/figures
```

作成後のディレクトリ構成は次のとおりである．`data/`は第1回で用意した共通フォルダであり，`03/`の中には作らない．

```text
applied_programming_ii/
├── data/
│   └── population_japan.csv
└── 03/
    ├── README.md
    ├── notebooks/
    │   └── population_exponential.ipynb
    └── reports/
        └── figures/
```

2. `notebooks/population_exponential.ipynb`を新規作成せよ．

3. `03`フォルダに`README.md`を作成し，次のテンプレートを記入せよ．解答欄は各設問に取り組んだ後で埋めよ．

```markdown
# 応用プログラミングII 第3回

- 氏名：
- 学籍番号：

## 今日の目標

人口データを確認し，指数成長モデルのパラメタを推定して，推定期間内外の残差を比較する．

## 演習1：データの確認

| 項目 | 確認した内容 |
| --- | --- |
| 提供機関 | |
| 統計の名称 | |
| 取得日 | |
| 利用条件 | |
| 時間間隔 | |
| 期間 | |
| 単位 | |
| 欠損・注意すべき年 | |

- 最小人口とその年：
- 最大人口とその年：
- 前年より人口が減少した年：
- 減少年について，注記から確認できることと追加資料が必要なこと：

## モデルの記録

- 微分方程式：dN/dt = r N
- 仮定：
- パラメタ r の値と決め方：
- 初期値：

## 演習2：推定期間の比較

| 推定期間 | r [1/年] | N0 [万人，1920年に対応] |
| --- | --- | --- |
| 1920〜1970年 | | |
| 1920〜1940年 | | |
| 1920〜1990年 | | |
| 1920〜2020年 | | |
| 1950〜1970年 | | |

- 推定期間によるrの変化と対数グラフとの関係：
- 1950〜1970年と1920〜1970年の比較：

## 演習3：図と残差

- 残差が正の期間とその意味：
- 残差が負の期間とその意味：
- 1945年と2020年の残差の解釈：

| 推定方法（1920〜1970年） | 2020年のモデル値 [万人] | 観測値 [万人] | 絶対誤差 [万人] |
| --- | --- | --- | --- |
| 2時点法 | | | |
| 対数線形法 | | | |

- 2020年の絶対誤差の比較と，1時点だけで判断することの問題点：

## 演習4：外挿期間と誤差

| 推定期間 | 評価する年 | モデル値 [万人] | 観測値 [万人] | 差（モデル値−観測値）[万人] |
| --- | --- | --- | --- | --- |
| 1920〜1940年 | 1970 | | | |
| 1920〜1940年 | 2000 | | | |
| 1920〜1940年 | 2020 | | | |
| 1920〜1970年 | 1970 | | | |
| 1920〜1970年 | 2000 | | | |
| 1920〜1970年 | 2020 | | | |

- 推定期間・外挿期間による差の変化：
- 1940年から1970年，2020年から2050年への予測の共通点と違い：

## 課題1：1950年までのデータによる外挿

- 推定したr [1/年]：
- 推定したN0 [万人]：
- 比較図と残差図のファイル名：

| 年 | モデル値 [万人] | 観測値 [万人] | 差（モデル値−観測値）[万人] |
| --- | --- | --- | --- |
| 1970 | | | |
| 1990 | | | |
| 2020 | | | |

- 予測の問題点（200字程度）：

## 課題2：観測量と状態変数

- 対応関係と相違点の説明（200字程度）：

## 課題3：ヨウ素131濃度の指数減衰モデル

### 1．データの確認

| 項目 | 確認した内容 |
| --- | --- |
| 提供機関・資料名・出典URL | |
| 取得日・利用条件・加工内容 | |
| 採取地点・対象核種 | |
| 期間・件数・日付の間隔 | |
| 単位・欠損・不検出の有無 | |
| 通常のグラフと対数グラフのファイル名 | |

- 全体の傾向と，前日より濃度が上昇した日の有無：

### 2．モデルの設定

- 状態変数・時刻の原点・各量の単位：
- 仮定：
- 微分方程式・初期条件・解析解：

### 3．パラメタ推定（設問5の結果も記入）

| 推定方法 | 推定に使う期間（2011年） | C0 [Bq/kg，3月21日に対応] | λ [1/日] | 見かけの半減期 [日] |
| --- | --- | --- | --- | --- |
| 2時点法 | 3月21日・28日 | | | |
| 対数線形法 | 3月21〜28日 | | | |
| 対数線形法 | 3月21〜31日 | | | |

### 4．観測値との比較

- 比較図と残差図のファイル名：

| 推定方法（3月21〜28日） | 評価期間（2011年） | MSE [(Bq/kg)^2] | RMSE [Bq/kg] |
| --- | --- | --- | --- |
| 2時点法 | 3月21〜28日 | | |
| 2時点法 | 3月29日〜4月3日 | | |
| 対数線形法 | 3月21〜28日 | | |
| 対数線形法 | 3月29日〜4月3日 | | |

- 推定方法・評価期間による誤差の違いと，残差の時間変化：

### 5．推定期間の変更と外挿

| 対数線形法の推定期間（2011年） | 4月10日のモデル値 [Bq/kg] |
| --- | --- |
| 3月21〜28日 | |
| 3月21〜31日 | |

- 推定期間によるパラメタと外挿値の違い：
- このCSVでは4月10日の予測誤差を求められない理由：

### 6．半減期の解釈とモデルの限界

- 推定した見かけの半減期と，物理的半減期との比較：
- 放射性崩壊以外に濃度を変化させうる要因と，このデータだけでは特定できないこと（200字程度）：
```

4. Notebookの最初のコードセルに以下を入力し，実行できることを確認せよ．

```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp

plt.rcParams["font.family"] = "Hiragino Sans"  # 日本語表示用（macOS）

PROJECT_DIR = Path.home() / "applied_programming_ii" / "03"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("人口データの有無:", (DATA_DIR / "population_japan.csv").exists())
```

```{dropdown} コードの補足

- `import pandas as pd`：表形式のデータを扱うpandasを読み込む．
- `.exists()`：指定したファイルやフォルダが存在すれば`True`を返す．
- データがない場合：[授業用CSV](../data/population_japan.csv)をダウンロードし，共通の`data/`に保存してから再実行する．
```
````

## 復習：第1・2回から再利用する内容

[第1回](1_modeling.md)の人口データの扱いと，[第2回](2_ode_simulation.md)の初期値問題の計算を，今回の作業に必要な範囲で確認する．準備のセルを実行した後，以下の順に進める．

- 第1回からの接続：データの出典・単位・期間を確認し，人口の観測値を比較できる状態にする．
- 第2回からの接続：初期値と係数からモデル値を計算し，数値計算の誤差とデータとの不一致を区別する．
- この節の到達点：`population`と`population_10k`列，右辺の関数と解析解の関数を用意し，後続の推定・比較で再利用する．

### 第1回の復習：人口データの読み込みと確認

- 復習の目的：比較する人口値の単位・時点・対象範囲を揃え，データの読み違いをモデルの誤差と取り違えないようにする．
- 再利用する操作：CSVの読み込み，万人単位への変換，期間と行数の確認，観測量と状態変数の区別．
- 今回の確認事項：年の間隔・欠損値・注記も確認し，推定期間を選ぶ際の注意点を記録する．

#### 出典と利用条件

- 使用ファイル：`population_japan.csv`．総務省統計局「人口推計」の長期時系列データから整形した授業用CSV．
- 元の統計：「我が国の推計人口（大正9年〜平成12年）」と「長期時系列データ（平成12年〜令和2年）」．
- 整形内容：総人口の年次系列を取り出し，1つのファイルに結合した．基準日は原則10月1日であり，例外は注記を確認する．
- 出典・取得日・利用条件：[授業用データ一覧](../data/README.md)に記載されている情報を確認する．加工したデータを利用する際は，出典と加工した旨を記録する．

レポートで使うデータについては，少なくとも次を記録する習慣をつける．

| 記録する項目 | 内容 |
| --- | --- |
| 提供機関 | 総務省統計局 |
| 統計の名称 | 人口推計 長期時系列データ |
| 取得日 | データ一覧に記載の日付 |
| 利用条件 | 政府標準利用規約（第2.0版） |
| 時間間隔 | 年次（各年10月1日現在） |
| 期間 | 1920〜2020年 |
| 単位 | 千人 |

#### 単位，期間，欠損を確かめる

- 確認項目：先頭・末尾の値，行数，期間，年の間隔，欠損値の数．
- 単位の変換：千人から万人への変換では10で割る．例えば55963千人は5596.3万人であり，元の列を残して比較用の列を追加する．

```python
population = pd.read_csv(DATA_DIR / "population_japan.csv")

# 単位を千人から万人に直した列を追加する．以後はこの列を使う．
population["population_10k"] = population["total_population_thousand"] / 10

print(population.head(3))
print(population.tail(3))
print()
print("行数:", len(population))
print("期間:", population["year"].min(), "〜", population["year"].max())
print("年の間隔:", np.unique(np.diff(population["year"])))
print("欠損値の数:")
print(population.isna().sum())
```

```{dropdown} コードの補足

- `pd.read_csv(...)`：CSVを表形式のデータ（DataFrame）として読み込む．`population["year"]`のように列名で1列を取り出す．
- `.head(3)`・`.tail(3)`：先頭・末尾の3行を表示する．`len(...)`は行数を返す．
- `.min()`・`.max()`：最小値・最大値を求める．
- `np.diff(...)`：隣り合う値の差を求める．`np.unique(...)`は重複を除いた値を返す．
- `.isna().sum()`：欠損値かどうかを判定し，列ごとの欠損数を数える．
```

出力結果は次の基準で確認する．

| 確認項目 | このデータでの結果 | 確認する理由 |
| --- | --- | --- |
| 期間・行数 | 1920〜2020年，101行 | 推定に使う年が含まれているかを確かめる． |
| 年の間隔 | `[1]` | 年が昇順で1年ずつ並んでいることを確かめる．前年との差を計算する前提となる． |
| 人口列の欠損数 | 0 | 各時点の人口値を使えることを確かめる． |
| `note`列の欠損 | 注記のない年で生じる | 人口値の欠測とは区別する． |

- 想定と異なる結果の場合：単位変換や推定へ進む前に，読み込んだファイル・列名・年の順序を確認する．
- 人口列：このCSVでは全年の値がそろっている．
- `note`列の空欄：人口値の欠測ではなく，個別の注記がないことを表す．
- `note`列の値：国勢調査や補正人口など，値の作成方法を示す．

```python
print(population[population["note"].notna()].to_string(index=False))
```

- `.notna()`：欠損でない行を判定する．`population[条件]`で該当行だけを取り出す．
- `.to_string(index=False)`：表を省略せず文字列にし，行番号を付けずに表示する．

- `census`は国勢調査の結果で，5年ごとに入る
- 1940年は「1940年国勢調査に基づく補正人口」，1945年は「1945年人口調査（11月1日）に基づく補正人口」，1947年は「臨時国勢調査人口」で，戦中戦後の混乱期に通常と異なる方法で得られた値である
- データ一覧に記されているとおり，1945〜1971年の値は沖縄県を含まない

1940年代の値を見ておく．

```python
print(population[(population["year"] >= 1940) & (population["year"] <= 1950)][["year", "population_10k", "note"]].to_string(index=False))
```

- `(条件1) & (条件2)`：両方の条件を満たす行を選ぶ．各条件を括弧で囲む．列名のリストを指定すると，その列だけを取り出せる．

- 観測された変化：1944年から1945年にかけて約230万人減少している．
- 比較上の注意：1945年は人口調査に基づく補正人口であり，集計範囲から沖縄県が外れている．
- 解釈の限界：総人口の系列だけから，死亡・人口移動・集計範囲の変更の寄与を分離することはできない．
- モデルとの関係：一定の増加率を仮定するモデルには，こうした人口動態や集計上の変化を明示的に組み込んでいない．

#### データの列とモデルの変数の対応

第1回で区別した観測量と状態変数を，今回の記号に対応させる．観測値は特定時点で記録された値であり，モデルの状態変数は時刻の関数として定義する．

| データの列 | モデルの記号 | 対応の仕方 |
| --- | --- | --- |
| `year` | $t$ | $t = \text{year} - 1920$（年） |
| `population_10k` | $y_i$ | 時刻 $t_i$ における状態変数 $N(t_i)$ の観測値（万人）とみなす |
| `note` | — | 測り方の注記．モデルには使わないが，ずれの解釈に使う |

- 観測値 $y_i$：統計に記録された人口．集計方法や対象範囲の影響を含む．
- モデル値 $N(t_i)$：仮定とパラメタに基づいて計算した人口．
- 比較の条件：同じ時刻・単位・対象範囲に対応する値を比較する．集計範囲が変わる年は，その影響を注記として残す．
- 時刻の対応：1920年は $t=0$，1970年は $t=50$．年そのものと経過年数を混同すると，解析解の指数部分が変わってしまう．

````{dropdown} コードの補足：最小値・最大値と減少年の抽出

```python
print(population["population_10k"].describe())
min_value = population["population_10k"].min()
max_value = population["population_10k"].max()
print(population[population["population_10k"] == min_value][["year", "population_10k"]])
print(population[population["population_10k"] == max_value][["year", "population_10k"]])

change = population["population_10k"].diff()
print(population[change < 0][["year", "population_10k", "note"]].to_string(index=False))
```

- `.describe()`：件数・平均・標準偏差・最小値・四分位数・最大値を表示する．年は別の列から取得する．
- [`.diff()`](https://pandas.pydata.org/docs/reference/api/pandas.Series.diff.html)：各行の値から直前の行の値を引く．最初の行は比較対象がないため欠損となる．年の昇順に並んだ年次データで使う．
- `change < 0`：前年より減少した行を選ぶ条件．最初の行の欠損値はこの条件を満たさない．
````

````{note} 演習1：データの確認を記録する

1. 上で確認した内容を，`README.md`の演習1の表に記入せよ．
2. `population["population_10k"].describe()`を実行し，最小値・最大値と，それぞれに対応する年を記入せよ．
3. 人口が前年より減少した年をすべて列挙せよ．注記から確認できる事情と，原因を判断するために追加資料が必要な事項を区別して記述せよ．
````

<!--
```{dropdown} 演習1の確認

- 最小値：1920年，5596.3万人．最大値：2008年，12808.4万人．
- 前年より減少した年：1945年，2005年，2009年，2011〜2020年．
- 注記から確認できること：1945年の調査・補正方法と，1945〜1971年の沖縄県の除外．
- 追加資料が必要なこと：減少を出生・死亡・人口移動などに分けて説明するには，それぞれの統計が必要である．
```
-->

### 第2回の復習：初期値問題と計算結果の確認

- 復習の目的：モデルの解を計算する操作と，観測値からモデルの妥当性を調べる操作を区別する．
- 今回の使い方：指数成長モデルには解析解があるため，本文の推定・比較には解析解を使う．`solve_ivp`は数値解の意味を確認する復習用とする．

- 初期値問題：$N'=rN$，$N(t_0)=N_0$．第2回の状態変数 $x$ を，今回は人口を表す $N$ に置き換える．
- 初期値と係数：$N_0$ は基準時刻 $t_0$ の人口，$r$ は一人あたりの増加率．初期値・係数・計算時刻を指定するとモデル値が決まる．
- 解析解：$N(t)=N_0e^{r(t-t_0)}$．$t=t_0$ を代入すると $N(t_0)=N_0$ となる．
- 数値解：`solve_ivp`に右辺の関数・計算区間・初期値・係数を渡し，`sol.y[0]`から近似値を取り出す．
- 出力時刻：`t_eval`は結果を取り出す時刻の指定であり，内部の刻み幅の指定ではない．
- 精度の確認：解析解との差の絶対値を計算する．`sol.success`が`True`でも，精度が保証されるわけではない．

今回も使う2つの関数を定義する．`exponential_rhs`は変化率を，`exponential_solution`は指定した時刻のモデル値を返す．両者の戻り値の意味を区別する．

```python
def exponential_rhs(t, N, r):
    """指数成長モデル dN/dt = r N の右辺．"""
    return r * N


def exponential_solution(t, N0, r, t0=0.0):
    """初期条件 N(t0) = N0 に対する解析解．"""
    return N0 * np.exp(r * (t - t0))
```

````{dropdown} 復習用コード：数値解と解析解の比較

以下は第2回の計算条件による確認用のコードであり，人口データへの適合ではない．

```python
t_review = np.linspace(0.0, 10.0, 101)
sol_review = solve_ivp(
    exponential_rhs, (0.0, 10.0), [100.0],
    t_eval=t_review, args=(0.2,)
)
N_exact_review = exponential_solution(sol_review.t, 100.0, 0.2)
print("成功したか:", sol_review.success)
print("時刻の配列の形:", sol_review.t.shape)
print("解の配列の形:", sol_review.y.shape)
print("出力時刻上の最大絶対誤差:",
      np.max(np.abs(sol_review.y[0] - N_exact_review)))
```

- 計算条件：初期値100，係数0.2，区間0〜10．この復習例では物理的な単位を設定しない．
- 配列の形：正常終了時，`sol_review.t`は`(101,)`，`sol_review.y`は`(1, 101)`．状態変数1個について101時点の値が格納される．
- 誤差の計算：同じ出力時刻の数値解と解析解を引き，絶対値の最大を求める．誤差が0でないことは，計算失敗を意味しない．
- `np.exp(...)`・`np.log(...)`：指数関数と自然対数．
- `np.abs(...)`・`abs(...)`：配列の各要素・数値1つの絶対値．`np.max(...)`で配列の最大値を求める．
- 描画・保存：`ax.plot`，`ax.set_xlabel`，`ax.set_ylabel`，`ax.legend`，`fig.savefig`は第2回のコードを再利用する．
````

## 仮定から式へ：指数成長モデル

### 仮定を言葉で置く

人口の変化について，最も単純な仮定を置く．

**仮定：単位時間あたりの人口の増加量は，現在の人口に比例する．**

- 出生率 $b$：一人あたり・単位時間あたりの出生数に対応する係数．時間によらず一定とする．
- 死亡率 $d$：一人あたり・単位時間あたりの死亡数に対応する係数．時間によらず一定とする．
- 短時間の変化：十分短い $\Delta t$ の間の出生数を $bN\Delta t$，死亡数を $dN\Delta t$ と近似する．
- 省略する要因：年齢構成の違い，人口移動，出生率・死亡率の時間変化．

### 式を導く

時刻 $t$ の人口を $N(t)$ とすると，十分短い $\Delta t$ の間の変化量は，人口移動を無視すると近似的に

$$
N(t + \Delta t) - N(t) \approx bN(t)\,\Delta t - dN(t)\,\Delta t = (b - d)\,N(t)\,\Delta t
$$

である．
両辺を $\Delta t$ で割り，$\Delta t \to 0$ とすると，

$$
\frac{dN}{dt} = (b - d)\,N = r\,N,
\qquad r = b - d
$$

を得る．
これが**指数成長モデル**である．
$r$ は一人あたりの純増加率で，出生率と死亡率の差である．

| 項 | 意味 | 単位 |
| --- | --- | --- |
| $N$ | 時刻 $t$ の人口 | 万人 |
| $\dfrac{dN}{dt}$ | 人口の変化率 | 万人／年 |
| $r$ | 一人あたり，1年あたりの純増加率 | 1／年 |
| $rN$ | 人口の瞬間的な変化率（負の場合は減少） | 万人／年 |

右辺の単位は $(1/\text{年}) \times \text{万人} = \text{万人}/\text{年}$ で，左辺と一致する．

- モデルの範囲：出生・死亡を人口に比例する項で表し，出入国・年齢構成・資源制約は明示的に扱わない．
- 検証する仮定：一定の $r$ で，対象期間の人口変化をどの程度近似できるかをデータで調べる．

## パラメタをデータから決める

### 観測値と時間の準備

- 状態変数 $N$：人口を表し，単位は万人．
- 時刻 $t$：1920年からの経過年数を表し，単位は年．
- 使用する関数：復習節で定義した`exponential_solution`．以後は解析解を使って，観測値との比較に集中する．

観測値を配列として取り出し，時間 $t$ を1920年からの経過年に直す．

```python
year_obs = population["year"].to_numpy()
t_obs = (year_obs - 1920).astype(float)        # 1920年を t = 0 とする [年]
y_obs = population["population_10k"].to_numpy()  # 観測値 [万人]

N0 = y_obs[0]                                   # 初期値：1920年の人口 [万人]
print(f"初期値 N0 = {N0:.1f} 万人")
```

```{dropdown} コードの補足

- `.to_numpy()`：表の1列をNumPy配列に変換する．
- `.astype(float)`：値を浮動小数点数に変換する．
- `y_obs[0]`：配列の先頭要素．年の昇順を確認したこのデータでは1920年の観測値．
```

### 2時点法

1920年と1970年の値を使い，復習節の解析解から $r$ を求める．
$N(50) = N_0 e^{50r}$ が1970年の観測値に一致するように，$r = \ln(y_{1970}/y_{1920}) / 50$ とする．

```python
y_1970 = y_obs[year_obs == 1970][0]
r_two_point = np.log(y_1970 / N0) / 50.0
print(f"2時点法による r = {r_two_point:.5f} /年")
```

- `y_obs[year_obs == 1970][0]`：1970年に対応する観測値を抽出し，その1要素を取り出す．
- 人口比の単位：分子・分母をともに万人で与え，単位によらない比をとる．

### 2時点法の弱点

- 使用するデータ：1920年と1970年の2時点のみ．途中の49時点は推定に使わない．
- 注意点：どちらかの値に集計上の特殊な事情があれば，推定値に影響する．
- 別の方法：1920〜1970年の51時点を使い，対数上の直線を最小二乗法で求める．

### 対数線形の最小二乗法

解析解の対数をとると，

$$
\ln N(t) = \ln N_0 + r\,t
$$

となる．ここでは $y_i>0$ とし，人口の数値は万人単位で統一して対数をとる．

- 対数線形モデル：$\ln y_i$ を $t_i$ の一次式 $a+rt_i$ で近似する．傾きは $r$，切片は $a=\ln N_0$．
- 最小二乗法：差の二乗和が最小となる係数を求める方法．今回は $\sum_i[\ln y_i-(a+rt_i)]^2$ を最小にする．
- 計算方法：`np.polyfit(..., 1)`で一次式の傾きと切片を求め，$N_0=e^a$ とする．
- 注意点：人口そのものの残差二乗和を最小にする方法とは異なる．一般のモデルへの適用は第7回で扱う．

```python
# パラメタを決めるのに使う期間
fit_mask = year_obs <= 1970

slope, intercept = np.polyfit(t_obs[fit_mask], np.log(y_obs[fit_mask]), 1)
r_loglinear = slope
N0_loglinear = np.exp(intercept)

print(f"対数線形の最小二乗法による r  = {r_loglinear:.5f} /年")
print(f"同じ方法で決めた N0          = {N0_loglinear:.1f} 万人（観測値は {N0:.1f} 万人）")
print(f"2時点法との差                = {r_loglinear - r_two_point:+.5f} /年")
```

```{dropdown} コードの補足

- `fit_mask`：推定に使う時点を`True`，使わない時点を`False`とする配列．
- `t_obs[fit_mask]`：推定対象の時刻を取り出す．人口にも同じ条件を適用して対応を保つ．
- [`np.polyfit(x, y, 1)`](https://numpy.org/doc/stable/reference/generated/numpy.polyfit.html)：一次式を最小二乗法で当てはめ，傾き・切片の順に返す．
- `np.exp(intercept)`：対数上の切片から $N_0$ を求める．
- 期間の指定：開始年も指定する場合は`(year_obs >= 開始年) & (year_obs <= 終了年)`を使う．条件を変更した後は，推定と描画のセルも再実行する．
```

- 推定した増加率：両方法とも約0.0124／年．連続時間の相対増加率を表す．
- 1年間の増加割合：$e^r-1$ であり，約1.2%．$r$ 自体とは区別する．
- 推定した初期値：対数線形法では $N_0$ も推定され，1920年の観測値より約50万人大きい．
- 初期値の違いの理由：1920年の観測値を通る制約を置かず，51時点の対数残差二乗和を最小にするため．

対数をとった図で確かめる．
指数成長が成り立つ期間では，点が直線上に並ぶ．

```python
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(year_obs, np.log(y_obs), color="black", marker="o", markersize=3, linestyle="none", label="ln(observed)")
ax.plot(year_obs, intercept + slope * t_obs, label=f"least-squares line (r = {r_loglinear:.4f})")
ax.axvline(1970, color="gray", linestyle=":", label="end of fitting period")
ax.set_title("Log of population vs. year")
ax.set_xlabel("Year")
ax.set_ylabel("ln N")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "log_population_line.png", dpi=150)
plt.show()
```

- `ax.axvline(1970, ...)`：横軸の1970年の位置に縦線を描く．推定期間の終点を変更したときは，この値も変更する．

1920年から1970年までは，1945年前後の落ち込みを除いて点がほぼ直線に乗る．
1975年以降は点が直線の下に外れ，外れ方は年とともに広がる．

````{note} 演習2：パラメタを決める期間を変える

1. 推定に使う期間を1920〜1940年，1920〜1990年，1920〜2020年に変更し，それぞれ $r$ と $N_0$ を求めよ．本文の1920〜1970年の結果とともに，`README.md`の表に記入せよ．
2. 推定期間による $r$ の変化を，対数グラフの点の並び方から説明せよ．
3. 推定期間を1950〜1970年に変更して $r$ と $N_0$ を求め，表に記入せよ．1920〜1970年の推定結果と比較せよ．時間の原点は1920年のままとし，$N_0$ は1920年に対応するモデル値として扱え．
````

## オープンデータとの比較

### 観測値とモデルを同じ図に描く

演習2で変更した条件を1920〜1970年に戻し，$r$ と $N_0$ を再計算する．この節以降の基準モデルには，この推定結果を用いる．

```python
fit_mask = (year_obs >= 1920) & (year_obs <= 1970)
slope, intercept = np.polyfit(t_obs[fit_mask], np.log(y_obs[fit_mask]), 1)
r_loglinear = slope
N0_loglinear = np.exp(intercept)
N_model = exponential_solution(t_obs, N0_loglinear, r_loglinear)

fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(year_obs, y_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
ax.plot(year_obs, N_model, label=f"exponential model (r = {r_loglinear:.4f})")
ax.axvline(1970, color="gray", linestyle=":", label="end of fitting period")
ax.set_title("Exponential growth model vs. observed population of Japan")
ax.set_xlabel("Year")
ax.set_ylabel("Population [10^4 persons]")
ax.set_ylim(0, 20000)
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "population_exponential_fit.png", dpi=150)
plt.show()
```

### 残差を描く

- 残差：観測値からモデル値を引いた値 $y_i-N(t_i)$．正ならモデルが過小評価，負なら過大評価している．
- 目的：比較図だけでは読み取りにくい差の符号・大きさ・時間変化を示す．
- 第2回との違い：解析解と数値解の差ではなく，観測値とモデルの差を扱う．

```python
residual = y_obs - N_model

fig, ax = plt.subplots(figsize=(8, 3.5))
ax.plot(year_obs, residual, marker="o", markersize=3)
ax.axhline(0, color="black", linewidth=0.8)
ax.axvline(1970, color="gray", linestyle=":")
ax.set_title("Residual: observed - model")
ax.set_xlabel("Year")
ax.set_ylabel("Residual [10^4 persons]")
ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "population_exponential_residual.png", dpi=150)
plt.show()
```

`ax.axhline(0, ...)`は残差0の水平線を描く．基準モデルの残差の図から，次が読み取れる．

- 1920〜1940年：残差の絶対値は最大約120万人で，正負が入れ替わる．
- 1945年前後：残差が大きく負になる．集計方法・範囲の変更に注意が必要であり，人口変動の原因はこの図だけでは特定できない．
- 1950〜1970年：残差の絶対値は200万人程度以内．
- 1975年以降：観測値がモデルを下回り続け，2020年には約7000万人の差になる．

### 誤差を数値で表す

残差の大きさを1つの数にまとめる指標として，**平均二乗誤差**を使う．

$$
\mathrm{MSE} = \frac{1}{n}\sum_{i=1}^{n}\left(y_i - N(t_i)\right)^2
$$

単位は（万人）$^2$ で，平方根をとれば人口と同じ単位（万人）になる．
以後の回でも同じ関数を使う．

```python
def mean_squared_error(y_obs, y_model):
    """観測値とモデル値の平均二乗誤差を返す．"""
    return np.mean((y_obs - y_model) ** 2)


mse_fit = mean_squared_error(y_obs[fit_mask], N_model[fit_mask])
mse_after = mean_squared_error(y_obs[~fit_mask], N_model[~fit_mask])

print(f"パラメタ決定に使った期間（1920〜1970年）の MSE = {mse_fit:12.1f} （万人）^2，平方根 = {np.sqrt(mse_fit):7.1f} 万人")
print(f"それ以降の期間（1971〜2020年）の MSE           = {mse_after:12.1f} （万人）^2，平方根 = {np.sqrt(mse_after):7.1f} 万人")
```

```{dropdown} コードの補足

- `** 2`：各要素を二乗する．`np.mean(...)`で算術平均を求める．
- `~fit_mask`：`True`と`False`を反転し，推定に使わなかった時点を選ぶ．
- `np.sqrt(...)`：平方根を求める．MSEの平方根がRMSE．
```

- RMSE（二乗平均平方根誤差）：人口と同じ単位で差の大きさを表す指標．基準モデルでは推定期間内が百数十万人程度，その後が数千万人となる．
- 評価する期間：推定に使用した期間と使用しなかった期間を分けて計算する．
- 後続の講義：第7回・第12回で訓練期間と検証期間の区別を扱う．

````{note} 演習3：図と残差を読む

1. 残差が正の期間と負の期間を`README.md`に記入し，それぞれ観測値とモデル値の大小関係を説明せよ．
2. 1945年と2020年の負の残差について，集計上の注意点と一定の増加率という仮定の限界を区別して説明せよ．原因の特定には追加資料が必要であることにも言及せよ．
3. 2時点法の $r$ と1920年の観測値 $N_0$ を使い，比較図と残差図を描け．両推定方法の2020年のモデル値・観測値・絶対誤差を表に記入し，比較せよ．1時点の誤差だけで他の年への適用可能性を判断できるかを説明せよ．
````

````{dropdown} コードの補足：推定方法を変えて比較する

基準モデルの変数を上書きせず，2時点法の結果を別の変数に保存する．本文の描画コードをコピーし，描く配列を置き換えれば比較できる．

```python
N_two_point = exponential_solution(t_obs, N0, r_two_point)
residual_two_point = y_obs - N_two_point
year = 2020
observed = y_obs[year_obs == year][0]
model_two_point = N_two_point[year_obs == year][0]
model_loglinear = N_model[year_obs == year][0]
print("2時点法:", model_two_point, observed, abs(model_two_point - observed))
print("対数線形法:", model_loglinear, observed, abs(model_loglinear - observed))
```

- 初期値：2時点法では観測値`N0`，対数線形法では推定値`N0_loglinear`を使う．係数だけでなく初期値も対応させる．
- 図の保存：比較図・残差図のラベルとファイル名も変え，基準モデルの図を上書きしない．
````

## 未来へ外挿する危険

- 外挿：パラメタを推定した期間の外側でモデル値を計算すること．
- 今回の条件：1920〜1970年の推定値を用いて2050年まで計算する．演習3で設定を変更した場合に備え，基準モデルを再計算する．

```python
fit_mask = (year_obs >= 1920) & (year_obs <= 1970)
slope, intercept = np.polyfit(t_obs[fit_mask], np.log(y_obs[fit_mask]), 1)
r_loglinear = slope
N0_loglinear = np.exp(intercept)
t_future = np.arange(0.0, 131.0)              # 1920年から2050年まで
N_future = exponential_solution(t_future, N0_loglinear, r_loglinear)

for year in [1970, 2000, 2020, 2050]:
    idx = int(year - 1920)
    line = f"{year}年: モデル {N_future[idx]:9.0f} 万人"
    if year <= 2020:
        observed = y_obs[year_obs == year][0]
        line += f"，観測値 {observed:9.0f} 万人，差（モデル値−観測値） {N_future[idx] - observed:+9.0f} 万人"
    print(line)
```

```{dropdown} コードの補足

- `idx = int(year - 1920)`：1920年から1年刻みで並ぶ配列の添字に変換する．
- `if year <= 2020`：観測値のある年だけ比較する．2050年の観測値はこのデータにはない．
- `line += ...`：表示する文字列の末尾に追加する．`+9.0f`は正負の符号を付け，小数点以下0桁で表示する．
- 差の符号：この表はモデル値−観測値を用いる．残差（観測値−モデル値）とは符号が逆である．
```

- 2020年の比較：モデル値は観測値より約7000万人大きい．
- 2050年の計算値：約2億8500万人．一定の増加率が続くという仮定のもとでの値であり，観測値との比較はできない．
- 外挿の注意点：推定期間後に人口構成などが変化すると，仮定や推定パラメタが適用できなくなる可能性がある．
- 報告する条件：モデルの仮定，パラメタの推定期間，外挿する期間を明記する．外挿期間の長さだけで誤差の増減が決まるわけではない．

````{note} 演習4：外挿の幅と誤差

1. 推定に使う期間を1920〜1940年に変更して $r$ と $N_0$ を求め，1970年・2000年・2020年のモデル値と観測値との差（モデル値−観測値）を表に記入せよ．
2. 1920〜1970年で推定した場合も同じ表に記入し，推定期間・外挿期間による差の変化を説明せよ．
3. 1940年までのデータから1970年を予測する場合と，2020年までのデータから2050年を予測する場合の共通点と違いを説明せよ．
````

```{dropdown} コードの補足：演習4・課題1で再利用する箇所

- 推定：対数線形法のコードをコピーし，推定対象の年を選ぶ条件を変更する．`np.polyfit`から`r_loglinear`・`N0_loglinear`を求める行まで再実行する．
- 図：観測値との比較図・残差図を再利用する．`N_model`と`residual`を新しい推定値から計算し直し，縦線・ラベル・保存先ファイル名も変更する．
- 表：外挿の表示コードをコピーし，表示する年を設問に合わせる．1920〜1970年に戻すための推定コードはコピーせず，直前に推定した値を使う．
```

```{tip} データに合うことと現象を説明することは違う

- 全期間での推定：1920〜2020年を使うと，1920〜1970年で推定した場合より $r$ は小さくなる．
- 適合度の改善：全期間の対数残差二乗和は小さくなるが，人口増加・減少の仕組みを説明できたことにはならない．
- 評価する対象：誤差指標，残差の時間変化，モデルの仮定の3点を確認する．
```

## モデルの限界と改善の問い

- 推定期間内の適合：1920〜1970年では，純増加率を一定とする近似で人口の増加傾向を表せる．ただし，出生率・死亡率が実際に一定だったことを証明するものではない．
- 観測値の特徴：2008年に最大となり，その後は減少傾向にある．
- 定数係数モデルの限界：$N_0>0$ のとき，$r>0$ なら単調増加，$r<0$ なら単調減少，$r=0$ なら一定．増加から減少への転換は表せない．
- 検討する追加要因：出生率・死亡率の時間変化，年齢構成，出入国，資源や空間の制約．どの要因が必要かは，残差に加えて対応する統計で検討する．
- 次回の仮定：人口の増加に伴って一人あたりの増加率が低下する仕組みを式に加える．残差の形だけから，この仕組みが原因だと断定することはできない．

## まとめ

- データの確認：出典・単位・期間・欠損値・集計範囲を記録する．今回のデータでは1945年前後の注記と，1945〜1971年の沖縄県の除外に注意する．
- 指数成長モデル：$N'=rN$．$r$ は一定の一人あたり純増加率で，単位は1／年．
- 比較対象の区別：今回は観測値とモデル値の残差を評価する．第2回の数値計算の誤差とは異なる．
- パラメタ推定：2時点法は2つの観測値を使い，対数線形法は指定期間の全観測値の対数を使う．
- モデルの評価：残差の符号・大きさ・時間変化と，推定期間内外のMSE・RMSEを確認する．
- 外挿：推定期間外でも同じ仮定が適用できるかを検討し，予測値に計算条件と限界を添える．

## 課題

````{warning} 課題1：1950年までのデータで決めたモデルの外挿

1. 推定に使う期間を1920〜1950年に変更し，対数線形法で $r$ と $N_0$ を求めよ．推定値を`README.md`に記入せよ．
2. そのモデルを2020年まで計算し，観測値との比較図と残差図を作成して`reports/figures/`に保存せよ．推定期間の終わりを示す縦線も変更せよ．
3. 1970年・1990年・2020年のモデル値と観測値との差（モデル値−観測値）を表に記入せよ．
4. 1950年までのデータだけに基づき，設問3のモデル値を2020年の人口予測として提示することの問題点を200字程度で説明せよ．誤差の大小に加え，仮定の適用範囲と推定期間を検討せよ．
````

<!--
````{dropdown} 課題1の解答例

本文の準備・データ読み込み・関数定義を実行した後に，次のコードを実行する．数値の表は，丸める前の推定値を使って計算した結果である．

**1．パラメタの推定**

```python
fit_mask = (year_obs >= 1920) & (year_obs <= 1950)
slope, intercept = np.polyfit(t_obs[fit_mask], np.log(y_obs[fit_mask]), 1)
r_loglinear = slope
N0_loglinear = np.exp(intercept)
N_model = exponential_solution(t_obs, N0_loglinear, r_loglinear)
residual = y_obs - N_model

print(f"r = {r_loglinear:.8f} /年")
print(f"N0 = {N0_loglinear:.1f} 万人")
```

- 推定値：$r \approx 0.01207289$／年，$N_0 \approx 5661.5$万人．
- 初期値の意味：1920年に対応するモデル値．1920年の観測値5596.3万人に固定した値ではない．

**2．比較図と残差図**

```python
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(year_obs, y_obs, color="black", marker="o", markersize=3,
        linestyle="none", label="観測値")
ax.plot(year_obs, N_model, label="指数成長モデル")
ax.axvline(1950, color="gray", linestyle=":", label="推定期間の終わり")
ax.set_xlabel("年")
ax.set_ylabel("人口 [万人]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "assignment1_population_fit.png", dpi=150)
plt.show()

fig, ax = plt.subplots(figsize=(8, 3.5))
ax.plot(year_obs, residual, marker="o", markersize=3)
ax.axhline(0, color="black", linewidth=0.8)
ax.axvline(1950, color="gray", linestyle=":")
ax.set_xlabel("年")
ax.set_ylabel("残差 [万人]")
ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "assignment1_population_residual.png", dpi=150)
plt.show()
```

**3．モデル値と観測値の比較**

```python
for year in [1970, 1990, 2020]:
    observed = y_obs[year_obs == year][0]
    model = exponential_solution(year - 1920, N0_loglinear, r_loglinear)
    print(f"{year}年: モデル {model:.1f}，観測値 {observed:.1f}，差 {model - observed:+.1f} 万人")
```

| 年 | モデル値 [万人] | 観測値 [万人] | 差（モデル値−観測値）[万人] |
| --- | --- | --- | --- |
| 1970 | 10353.5 | 10372.0 | −18.5 |
| 1990 | 13181.1 | 12361.1 | +820.0 |
| 2020 | 18934.2 | 12614.6 | +6319.6 |

**4．考察の記述例**

1920〜1950年のデータから求めたモデルは，1970年の人口には近いが，2020年には約6320万人の過大評価となる．一定の純増加率が70年間続くと仮定しており，出生率・死亡率や年齢構成の変化を表していない．推定期間には戦中戦後の集計方法・範囲の変更も含まれる．したがって，この値を確実な予測として提示せず，推定期間と仮定を明記し，推定に使わなかった期間の観測値との比較や追加資料によって適用可能性を検討する必要がある．
````
-->

````{warning} 課題2：観測量と状態変数の対応を説明する

1. `README.md`のモデルの記録を完成させよ．1920〜1970年の対数線形法を基準として，推定値を記入せよ．
2. `population_10k`列の値と状態変数 $N(t)$ の対応関係，および集計方法とモデルの仮定の違いを200字程度で説明せよ．国勢調査年・補正人口・沖縄県の除外に関する注記を用いよ．
````

<!--
````{dropdown} 課題2の解答例

**1．モデルの記録**

課題1で変更した推定期間を1920〜1970年に戻して計算する．

```python
fit_mask = (year_obs >= 1920) & (year_obs <= 1970)
slope, intercept = np.polyfit(t_obs[fit_mask], np.log(y_obs[fit_mask]), 1)
r_loglinear = slope
N0_loglinear = np.exp(intercept)
print(f"r = {r_loglinear:.8f} /年，N0 = {N0_loglinear:.1f} 万人")
```

- 微分方程式：$dN/dt=rN$．$t$は1920年からの経過年数，$N$の単位は万人．
- 仮定：出生・死亡による変化量が人口に比例し，その差に対応する一人あたりの純増加率$r$が一定．人口移動や年齢構成の変化は明示的に扱わない．
- パラメタ：1920〜1970年の51時点に対する対数線形法から，$r\approx 0.01244342$／年．
- 初期条件：$N(0)=N_0\approx 5647.3$万人．$N_0$も対数線形法で推定した値．

**2．対応関係と相違点の記述例**

population_10k列は，統計に記録された人口を万人単位に直した離散時点の観測値である．一方，N(t)は一定の純増加率を仮定した微分方程式の連続時間の状態変数であり，各観測時点で両者を比較する．国勢調査年には調査結果が使われ，1940年・1945年には補正人口が含まれる．また，1945〜1971年は沖縄県を含まない．モデルは集計方法や対象範囲の変更を表していないため，残差をすべて人口動態の変化と解釈することはできない．
````
-->

````{warning} 課題3：福島第一原発事故後のヨウ素131濃度をモデル化する

2011年3月の福島第一原子力発電所事故後に公表された水道水の検査結果を用い，人口モデルと同じ手順で指数減衰モデルを構築・評価する．対象は，福島市の原子力センター福島支所で採取した水道水中のヨウ素131濃度である．

- 使用データ：[授業用CSV](../data/iodine131_fukushima_tapwater_2011.csv)．2011年3月21日〜4月3日の14件を収録している．共通の`~/applied_programming_ii/data/`に保存する．
- 出典：[厚生労働省の検査結果（2011年4月4日公表）](https://www.mhlw.go.jp/stf/houdou/2r98520000017x7l-img/2r98520000017xbt.pdf)．[データ一覧](../data/README.md)に抽出箇所・取得日・利用条件・加工内容を記載している．
- 観測量：ヨウ素131の放射能濃度．1 Bqは1秒あたり平均1回の放射性崩壊に相当し，Bq/kgは水1 kgあたりの放射能を表す．
- 時間：2011年3月21日を $t=0$ とし，日単位で扱う．事故発生日からの経過日数ではない．
- 作業場所：既存の`population_exponential.ipynb`に課題3の節を追加し，結果を`README.md`の同じ番号の解答欄に記入する．

1. **データの確認**：出典・利用条件・採取地点・核種・期間・件数・単位を確認し，記録せよ．日付の間隔と欠損・不検出の有無を確認せよ．横軸を経過日数とする観測値のグラフと，縦軸を対数目盛にしたグラフを作成せよ．全体の傾向と，前日より濃度が上昇した日の有無を記述せよ．
2. **モデルの構築**：放射能濃度を $C(t)$ とし，濃度の減少速度がその時点の濃度に比例すると仮定せよ．比例係数を時間によらない定数 $\lambda>0$，初期値を $C_0$ として，微分方程式・初期条件・解析解を示せ．$C(t)$，$C_0$，$t$，$\lambda$ の意味と単位を記入せよ．
3. **パラメタ推定**：3月21日と28日の観測値から2時点法で $\lambda$ を求めよ．次に，3月21〜28日の全観測値から対数線形法で $\lambda$ と $C_0$ を求めよ．それぞれの見かけの半減期を計算し，表に記入せよ．
4. **モデルの評価**：両推定方法について4月3日までのモデル値を求め，観測値との比較図と残差図を作成せよ．残差は観測値−モデル値とし，推定対象期間の終わりを縦線で示せ．3月21〜28日と3月29日〜4月3日を分けてMSE・RMSEを求め，推定方法・評価期間による違いと残差の時間変化を説明せよ．図は設問1の図とともに`reports/figures/`へ保存せよ．
5. **推定期間の変更と外挿**：対数線形法で用いる観測期間を3月31日まで延長し，$\lambda$・$C_0$・見かけの半減期を再推定せよ．3月28日までで推定したモデルと，3月31日までで推定したモデルから，それぞれ4月10日の濃度を計算せよ．推定期間によるパラメタと外挿値の違いを説明し，このCSVでは4月10日の予測誤差を求められない理由を述べよ．
6. **モデルの解釈**：設問3・5の見かけの半減期を，ヨウ素131の物理的半減期である約8日と比較せよ．毎日別の水を採取していることを踏まえ，放射性崩壊以外に濃度を変化させうる要因を挙げ，このデータだけでは要因を特定できない理由を200字程度で説明せよ．
````


````{dropdown} 課題3の解答例

本文の準備と，`exponential_solution`・`mean_squared_error`の定義を実行済みとする．以下のコードを設問番号の順に実行する．

**1．データの確認**

| 項目 | 確認結果 |
| --- | --- |
| 提供機関・資料 | 厚生労働省「水道水中の放射性物質に関する検査の実施状況」（2011年4月4日公表）．出典URLは課題本文のリンク参照 |
| 取得日・利用条件 | 2026年10月10日．公共データ利用規約（PDL1.0）に従い，出典と加工した旨を記載 |
| 加工内容 | 対象地点・期間のヨウ素131濃度を抽出し，日付と経過日数を付けた授業用CSV．平均化・補間は実施していない |
| 採取地点・核種 | 福島市の原子力センター福島支所．ヨウ素131 |
| 期間・件数・間隔 | 2011年3月21日〜4月3日，14件，1日間隔 |
| 単位・欠損・不検出 | Bq/kg．抽出した14件には欠損・不検出の記載なし |

```python
radioactivity = pd.read_csv(DATA_DIR / "iodine131_fukushima_tapwater_2011.csv")
t_decay = radioactivity["elapsed_days"].to_numpy().astype(float)
c_obs = radioactivity["iodine131_bq_kg"].to_numpy()

print(radioactivity)
print("件数:", len(radioactivity))
print("日付の間隔 [日]:", np.unique(np.diff(t_decay)))
print("欠損値の数:", radioactivity.isna().sum())
print("すべて正の値か:", np.all(c_obs > 0))
change = radioactivity["iodine131_bq_kg"].diff()
print("前日より濃度が上昇した日:")
print(radioactivity[change > 0][["date", "iodine131_bq_kg"]])

fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(t_decay, c_obs, color="black", marker="o", linestyle="none",
        label="観測値")
ax.set_xlabel("3月21日からの経過日数 [日]")
ax.set_ylabel("ヨウ素131濃度 [Bq/kg]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "assignment3_observed.png", dpi=150)
plt.show()

# 同じ図の縦軸を対数目盛に変え，別のファイルに保存する．
ax.set_yscale("log")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "assignment3_observed_log.png", dpi=150)
```

- 全体の傾向：濃度は23 Bq/kgから4.492 Bq/kgへ減少するが，単調減少ではない．対数目盛の図でも全体として右下がりである．
- 前日より上昇した日：3月23日，3月26日，3月27日，4月1日．一定係数の指数減衰モデルはこれらの上昇を表せない．

**2．モデルの設定**

$$
\frac{dC}{dt}=-\lambda C,\qquad C(0)=C_0,
\qquad C(t)=C_0e^{-\lambda t}.
$$

- 状態変数$C(t)$：時刻$t$の水道水中のヨウ素131濃度．単位はBq/kg．
- 時刻$t$：2011年3月21日からの経過日数．単位は日．
- 初期値$C_0$：3月21日に対応するモデルの濃度．単位はBq/kg．
- 係数$\lambda$：単位時間あたりの相対的な減少率．単位は1／日．時間によらない正の定数と仮定する．
- 仮定の範囲：複数の要因を分離せず，対象期間の濃度の減少傾向を1つの比例係数で近似する．放射性崩壊だけが作用すると断定する仮定ではない．

**3．パラメタ推定**

2時点法では$C_0=23$，$C(7)=12$とし，$\lambda=-\log(12/23)/7$を求める．対数線形法では，Bq/kg単位の濃度の数値を用いた対数上の傾きが$-\lambda$，切片が$\log C_0$となる．

```python
fit_decay = t_decay <= 7
C0_two_point = c_obs[0]
c_day7 = c_obs[t_decay == 7][0]
decay_rate_two_point = -np.log(c_day7 / C0_two_point) / 7
half_life_two_point = np.log(2) / decay_rate_two_point

slope_decay, intercept_decay = np.polyfit(
    t_decay[fit_decay], np.log(c_obs[fit_decay]), 1
)
decay_rate = -slope_decay
C0_loglinear = np.exp(intercept_decay)
half_life = np.log(2) / decay_rate

print("2時点法（C0，λ，半減期）:", C0_two_point, decay_rate_two_point, half_life_two_point)
print("対数線形法（C0，λ，半減期）:", C0_loglinear, decay_rate, half_life)
```

| 推定方法 | 推定対象（2011年） | C0 [Bq/kg] | λ [1/日] | 見かけの半減期 [日] |
| --- | --- | --- | --- | --- |
| 2時点法 | 3月21日・28日 | 23.0000 | 0.0929411 | 7.4579 |
| 対数線形法 | 3月21〜28日 | 21.5776 | 0.0936854 | 7.3987 |

**4．モデルの評価**

```python
C_two_point = exponential_solution(t_decay, C0_two_point, -decay_rate_two_point)
C_model = exponential_solution(t_decay, C0_loglinear, -decay_rate)
residual_two_point_decay = c_obs - C_two_point
residual_decay = c_obs - C_model

fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(t_decay, c_obs, color="black", marker="o", linestyle="none", label="観測値")
ax.plot(t_decay, C_two_point, label="2時点法")
ax.plot(t_decay, C_model, label="対数線形法")
ax.axvline(7, color="gray", linestyle=":", label="推定期間の終わり")
ax.set_xlabel("3月21日からの経過日数 [日]")
ax.set_ylabel("ヨウ素131濃度 [Bq/kg]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "assignment3_decay_fit.png", dpi=150)
plt.show()

fig, ax = plt.subplots(figsize=(8, 3.5))
ax.plot(t_decay, residual_two_point_decay, marker="o", label="2時点法")
ax.plot(t_decay, residual_decay, marker="o", label="対数線形法")
ax.axhline(0, color="black", linewidth=0.8)
ax.axvline(7, color="gray", linestyle=":")
ax.set_xlabel("3月21日からの経過日数 [日]")
ax.set_ylabel("残差 [Bq/kg]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "assignment3_decay_residual.png", dpi=150)
plt.show()

mse_two_fit = mean_squared_error(c_obs[fit_decay], C_two_point[fit_decay])
mse_two_after = mean_squared_error(c_obs[~fit_decay], C_two_point[~fit_decay])
mse_log_fit = mean_squared_error(c_obs[fit_decay], C_model[fit_decay])
mse_log_after = mean_squared_error(c_obs[~fit_decay], C_model[~fit_decay])
print("2時点法・3月21〜28日（MSE，RMSE）:", mse_two_fit, np.sqrt(mse_two_fit))
print("2時点法・3月29日以降（MSE，RMSE）:", mse_two_after, np.sqrt(mse_two_after))
print("対数線形法・3月21〜28日（MSE，RMSE）:", mse_log_fit, np.sqrt(mse_log_fit))
print("対数線形法・3月29日以降（MSE，RMSE）:", mse_log_after, np.sqrt(mse_log_after))
```

| 推定方法（3月21〜28日） | 評価期間（2011年） | MSE [(Bq/kg)^2] | RMSE [Bq/kg] |
| --- | --- | --- | --- |
| 2時点法 | 3月21〜28日 | 7.8117 | 2.7949 |
| 2時点法 | 3月29日〜4月3日 | 3.9120 | 1.9779 |
| 対数線形法 | 3月21〜28日 | 7.2543 | 2.6934 |
| 対数線形法 | 3月29日〜4月3日 | 2.3749 | 1.5411 |

- 推定方法の比較：このデータでは対数線形法のMSE・RMSEが両期間で小さい．ただし，対数線形法が最小化するのは対数残差の二乗和であり，元の濃度でのMSEが必ず小さくなるわけではない．
- 評価期間の比較：両方法とも後半のRMSEが小さい．後半は濃度自体も低く，異なる観測値の集合を比較しているため，外挿の精度が一般に高いとは結論できない．
- 残差の時間変化：3月23日・27日には両方法で正，3月24〜26日には負となる．3月29日以降は4月1日を除いて負であり，この期間では過大評価が多い．

**5．推定期間の変更と外挿**

```python
fit_decay_extended = t_decay <= 10  # 3月31日まで
slope_extended, intercept_extended = np.polyfit(
    t_decay[fit_decay_extended], np.log(c_obs[fit_decay_extended]), 1
)
decay_rate_extended = -slope_extended
C0_extended = np.exp(intercept_extended)
half_life_extended = np.log(2) / decay_rate_extended
print("3月31日まで（C0，λ，半減期）:", C0_extended, decay_rate_extended, half_life_extended)

prediction_day20 = exponential_solution(20, C0_loglinear, -decay_rate)
prediction_day20_extended = exponential_solution(20, C0_extended, -decay_rate_extended)
print("3月28日までで推定した4月10日の濃度:", prediction_day20, "Bq/kg")
print("3月31日までで推定した4月10日の濃度:", prediction_day20_extended, "Bq/kg")
```

| 対数線形法の推定期間（2011年） | C0 [Bq/kg] | λ [1/日] | 見かけの半減期 [日] | 4月10日のモデル値 [Bq/kg] |
| --- | --- | --- | --- | --- |
| 3月21〜28日 | 21.5776 | 0.0936854 | 7.3987 | 3.3133 |
| 3月21〜31日 | 22.9487 | 0.1161707 | 5.9666 | 2.2476 |

- 推定期間による違い：3月29〜31日の観測値は元のモデルより小さい．これらを加えると減衰係数が大きくなり，見かけの半減期と4月10日のモデル値は小さくなる．時刻の原点は同じであり，$C_0$はどちらも3月21日に対応する推定値である．
- 予測誤差を求められない理由：このCSVには4月3日までの観測値しかない．4月10日のモデル値同士の差は求められるが，観測値との差は求められない．

**6．モデルの解釈**

- 半減期の比較：2時点法で約7.46日，3月28日までの対数線形法で約7.40日，3月31日までの対数線形法で約5.97日となる．いずれも物理的半減期の約8日より短く，推定期間によっても変わる．
- 考察の記述例：このデータは同じ試料を保存して測ったものではなく，毎日採取した別の水の濃度である．濃度は放射性崩壊に加え，水源への放射性物質の流入，降水などによる希釈，浄水処理での除去などにも影響されうる．したがって，推定した係数は複数の作用を含む見かけの減少率である．各要因の寄与を特定するには，水源の濃度・流量・処理条件などの追加資料が必要であり，この濃度系列だけから減少の原因や健康影響を判断することはできない．
````


```{note} 物理的半減期と，濃度の見かけの半減期

- 放射性崩壊：不安定な原子核が別の原子核へ変化する現象．外部との物質の出入りがない試料では，ヨウ素131の放射能は物理的半減期に従って減少する．
- 物理的半減期：放射性崩壊によって原子核の数が半分になるまでの時間．ヨウ素131では約8日である（[環境省：半減期と放射能の減衰](https://www.env.go.jp/chemi/rhm/current/01-02-07.html)）．
- 見かけの半減期：今回の濃度モデル $C(t)=C_0e^{-\lambda t}$ が半分の値になるまでの時間．$T_{1/2}=\log 2/\lambda$ で求める．ここで $\log$ は自然対数である．
- 両者の違い：水道水の濃度には，放射性崩壊だけでなく水源への流入や希釈・除去なども影響しうる．推定した $\lambda$ は対象期間の濃度変化を近似する係数であり，ヨウ素131固有の崩壊定数とは限らない．
- 解釈の範囲：半減期が約8日に近くても，放射性崩壊だけで変化した証拠にはならない．この地点・期間の濃度から健康影響や現在の水道水の安全性を判断することもできない．
```

````{dropdown} コードの補足：人口モデルのコードを課題3に利用する

新しいライブラリは必要ない．本文のコードをコピーし，データ・時刻・パラメタ・軸ラベルを次のように対応させる．人口の結果を残すため，課題3では別の変数名を使う．

| 人口モデル | 濃度の減衰モデル |
| --- | --- |
| 人口の観測値`y_obs` | 濃度の観測値`c_obs` |
| 1920年からの経過年`t_obs` | 3月21日からの経過日数`t_decay` |
| 初期値 $N_0$ | 初期濃度 $C_0$ |
| 増加率 $r$ | 減衰係数の符号を反転した $-\lambda$ |
| 推定対象を選ぶ`fit_mask` | 推定対象を選ぶ`fit_decay` |

```python
radioactivity = pd.read_csv(DATA_DIR / "iodine131_fukushima_tapwater_2011.csv")
t_decay = radioactivity["elapsed_days"].to_numpy().astype(float)
c_obs = radioactivity["iodine131_bq_kg"].to_numpy()

print(radioactivity.head())
print(radioactivity.tail())
print("件数:", len(radioactivity))
print("日付の間隔 [日]:", np.unique(np.diff(t_decay)))
print("欠損値の数:", radioactivity.isna().sum())

# 3月21〜28日の8件を選ぶ．3月21日を0日とする．
fit_decay = t_decay <= 7
```

- 対数をとる条件：元資料で不検出の有無を確認したうえで，`np.all(c_obs > 0)`により濃度がすべて正であることを確かめる．不検出を0として対数をとる処理は行わない．
- 2時点法：本文の式 $r=\log(N_1/N_0)/(t_1-t_0)$ に濃度を代入し，符号を反転して $\lambda$ とする．初期値には3月21日の観測値を使う．
- 対数線形法：次のように傾きの符号を反転する．Pythonの`lambda`は構文に使う予約語なので，変数名には`decay_rate`を使う．

```python
slope_decay, intercept_decay = np.polyfit(
    t_decay[fit_decay], np.log(c_obs[fit_decay]), 1
)
decay_rate = -slope_decay
C0_loglinear = np.exp(intercept_decay)
C_model = exponential_solution(t_decay, C0_loglinear, -decay_rate)
half_life = np.log(2) / decay_rate
```

- 解析解の再利用：`exponential_solution`は係数が負の場合にも使える．2時点法でも，その方法で求めた初期値と係数を引数に渡す．
- 評価：`residual_decay = c_obs - C_model`とし，本文の描画コード・`mean_squared_error`・`np.sqrt`を再利用する．`fit_decay`と`~fit_decay`で評価期間を分ける．2時点法で使うのは端点2件のみだが，設問4では対数線形法と同じ期間の全件で評価する．
- 図の表示：横軸を`3月21日からの経過日数 [日]`，縦軸を`ヨウ素131濃度 [Bq/kg]`または`残差 [Bq/kg]`に変える．縦線も年ではなく経過日数で指定し，保存ファイル名は人口の図と区別する．
- 対数目盛：`ax.set_yscale("log")`で縦軸を対数目盛にする．この場合は`c_obs`をそのまま描き，`np.log(c_obs)`には置き換えない．
- 期間の変更：推定対象を選ぶ条件を変更し，傾き・切片・初期値・半減期を計算し直す．3月21日を時刻の原点とする設定は変えない．変更前の結果も表に記録する．
- 外挿：4月10日は3月21日から20日後である．`exponential_solution(20, C0_loglinear, -decay_rate)`で計算できる．各推定期間について計算し，観測値がない日の誤差は算出しない．
````

### 提出先・期限

- 提出場所：WebClass「第3回課題」
- 提出物：
  - `README.md`
  - Notebookファイル`population_exponential.ipynb`
- 提出期限：2026年10月17日(土)23:59

## 自主学習用の発展演習

````{dropdown} 発展演習：都道府県の人口に同じモデルを当てる

e-Statの同じ統計「我が国の推計人口（大正9年〜平成12年）」には，第5表「都道府県別人口」がある．

1. 都道府県を1つ選び，Excelファイルから年と人口を取り出してCSVに整形し，`~/applied_programming_ii/data/`に保存せよ．
2. 今回と同じ手順で $r$ を求め，全国と同じ推定期間で比較せよ．符号や大きさの違いを記述せよ．
3. 出典・取得日・単位・整形方法を`README.md`に記録せよ．増加率の違いを説明するために必要な追加資料を挙げよ．
````

## 次回への接続

- 今回の結果：1920〜1970年で推定した指数成長モデルは，その後の人口を過大評価する．
- 第4回：資源や空間の制約を想定し，一人あたりの増加率が人口に対して線形に減少するLogisticモデルを導く．
- 比較条件：指数成長モデルとLogisticモデルを，同じデータ・推定期間・誤差指標で比較する．
- 再利用する関数：`exponential_rhs`，`exponential_solution`，`mean_squared_error`．

## 自分の言葉で説明する問い

1. オープンデータを使う前に確認すべき項目を挙げ，それぞれを確認しないと何が起こりうるかを，今回の人口データの例で説明せよ．
2. 人口の変化率が現在の人口に比例するという仮定から $N' = rN$ が出てくる道筋を，出生率と死亡率という言葉を使って説明せよ．
3. 2時点法と対数線形の最小二乗法は，どちらも $r \approx 0.0124$ を与えた．後者が使用するデータと最小化する量を説明し，前者と比較した利点と注意点を述べよ．
4. 1920〜1970年でよく合うモデルが，2020年では7000万人近く外れた．このことから，将来を予測するときに何を添えるべきだと言えるか．
