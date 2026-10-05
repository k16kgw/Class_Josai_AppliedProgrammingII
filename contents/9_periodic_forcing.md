# 第9回　観光・電力需要と周期的外力

## 今回の位置付け

$$
\text{現象の理解}
\rightarrow
\underline{\text{仮定の設定}}
\rightarrow
\underline{\text{数理モデルの構築}}
\rightarrow
\text{数値シミュレーション}
\rightarrow
\underline{\text{データとの比較}}
\rightarrow
\text{パラメタ推定}
\rightarrow
\text{モデルの検証と改善}
$$

これまでのモデルの右辺 $f$ は，状態変数 $x$ だけで決まるか（第3〜5回），観測された入力 $u(t)$ を足したものだった（第6〜8回）．
今回は，右辺が時刻 $t$ そのものに陽に依存する $x' = f(t, x)$ の形を扱う．
題材は，訪日外客数と電力需要である．
観光では主に年周期，電力需要では年・週・日周期の変動が見られ，その周期性を式で表すところから始める．

今回は，微分方程式を無理に当てはめない回でもある．
周期的な変動を説明するには回帰的なモデルの方が自然な場合が多く，微分方程式モデルは時間依存の目標値と状態変数の差に比例した変化率を表したいときに意味を持つ．
両者の違いを整理することが今回の目標の1つである．

## 今回の到達目標

- 時系列の図から，年周期，週周期，日周期などの周期性を読み取れる
- 正弦関数 $A\sin(2\pi t/T + \phi)$ の振幅，周期，位相が図の何に対応するかを説明できる
- ベースライン，トレンド，周期成分を組み合わせた周期モデルを最小二乗法で当てはめ，残差を図で示せる
- 周期的な目標値に緩和する微分方程式 $x' = -\lambda\,(x - g(t))$ を実装し，回帰的な周期モデルとの違いを説明できる
- 周期性だけでは説明できない要因を，残差の時系列から具体的に指摘できる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第8回の復習，訪日外客数の時系列の観察（演習0） | 10分 |
| 2 | 正弦関数の振幅・周期・位相，周期モデルの構成，緩和モデルの導出 | 25分 |
| 3 | 最小二乗法による当てはめと残差，`solve_ivp`による緩和モデル | 20分 |
| 4 | 周期の追加，$\lambda$ の変更，残差の読み取り（演習1〜4） | 35分 |
| 5 | 周期性で説明できない要因の共有，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

第6回から第8回では，ダムの貯水量を

$$
V' = Q_{\mathrm{in}}(t) - Q_{\mathrm{out}}(t)
$$

と書き，流入量という観測データを時間依存の入力として与えた．
そこでは，入力 $Q_{\mathrm{in}}(t)$ は観測された値をそのまま補間して使った．

今回も右辺は時刻に依存するが，入力の与え方が異なる．
観測値を補間するのではなく，年周期で変動するという仮定を式にした関数 $g(t)$ を右辺に置く．
つまり，時間依存の入力そのものをモデル化する．

| 回 | 右辺の形 | 時間依存の部分 |
| --- | --- | --- |
| 第3〜5回 | $f(x)$ | なし |
| 第6〜8回 | $f(x) + u(t)$ | 観測値を補間した入力 |
| 第9回 | $f(t, x)$ | 周期関数として仮定した入力 |

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第9回の作業フォルダを作成する．データフォルダは共通のものを使う．

```bash
mkdir -p ~/applied_programming_ii/09
cd ~/applied_programming_ii/09
mkdir -p notebooks reports/figures
```

2. 講義サイトの[授業用データ一覧](../data/README.md)から`visitors_monthly.csv`をダウンロードし，`~/applied_programming_ii/data/`に置く．

3. `notebooks/periodic_forcing.ipynb`を新規作成する．

4. `09`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第9回

- 氏名：
- 学籍番号：

## 今日の目標

訪日外客数の周期性を周期モデルで表し，残差から周期性以外の要因を読み取る．

## 計算条件

- データ：訪日外客数（月次，JNTO）
- 当てはめ期間：2012年1月〜2019年12月
- 周期：T = 1 年
- 単位：万人/月

## 演習1〜4の記録

- 変更した条件：
- 実行前の予想：
- 実行後に分かったこと：

## 課題1

## 課題2の考察
```

5. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．

```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp

PROJECT_DIR = Path.home() / "applied_programming_ii" / "09"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("訪日外客数データの有無:", (DATA_DIR / "visitors_monthly.csv").exists())
```
````

## 導入：訪日外客数の時系列

日本政府観光局（JNTO）が公表する訪日外客数は，月ごとの人数である．
2003年1月から最新月までの総数を読み込み，時間軸の単位を年に換算する．
$k$ 月の値はその月の合計なので，時刻は月の中央 $t = \text{年} + (k - 0.5)/12$ に置く．

```python
visitors = pd.read_csv(DATA_DIR / "visitors_monthly.csv")

# 時間軸 [年]．各月の値を月の中央の時刻に対応させる．
visitors["t"] = visitors["year"] + (visitors["month"] - 0.5) / 12
# 単位を人から万人に直す．
visitors["visitors_10k"] = visitors["visitors"] / 1e4

print(visitors.head())
print("期間:", visitors["t"].min().round(3), "〜", visitors["t"].max().round(3), " 行数:", len(visitors))
print("2019年の合計: {:.0f} 万人，2020年の合計: {:.0f} 万人".format(
    visitors.loc[visitors["year"] == 2019, "visitors_10k"].sum(),
    visitors.loc[visitors["year"] == 2020, "visitors_10k"].sum()))
```

```python
fig, ax = plt.subplots(figsize=(9, 4))
ax.plot(visitors["t"], visitors["visitors_10k"], color="black", linewidth=1, marker="o", markersize=2, label="observed (monthly total)")
ax.set_title("Monthly foreign visitors to Japan (JNTO)")
ax.set_xlabel("Year")
ax.set_ylabel("Visitors [10^4 persons/month]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "visitors_observed.png", dpi=150)
plt.show()
```

この図には3種類の変動が重なっている．

- 長期的な増加傾向．2012年の約70万人/月から2019年の約270万人/月まで増えた
- 1年ごとに繰り返す上下．毎年春と夏に山，冬に谷がある
- 傾向にも周期にも当てはまらない急変．2011年3月の東日本大震災，2020年2月以降の新型コロナウイルス感染症による渡航制限

2012年から2019年の期間について，月ごとの平均値を求めると周期性がはっきり見える．

```python
fit_mask = (visitors["year"] >= 2012) & (visitors["year"] <= 2019)
fit_data = visitors[fit_mask].copy()

monthly_mean = fit_data.groupby("month")["visitors_10k"].mean()
print("2012〜2019年の月別平均 [万人/月]")
print(monthly_mean.round(1))

fig, ax = plt.subplots(figsize=(7, 4))
ax.bar(monthly_mean.index, monthly_mean.values, color="lightgray", edgecolor="black")
ax.set_title("Average visitors by month (2012-2019)")
ax.set_xlabel("Month")
ax.set_ylabel("Visitors [10^4 persons/month]")
ax.set_xticks(range(1, 13))
ax.grid(True, axis="y")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "visitors_by_month.png", dpi=150)
plt.show()
```

4月と7月が高く，9月と2月が低い．
ただし，月別平均の差は最大で約40万人であり，同じ期間の増加傾向（8年で約200万人）に比べると小さい．
周期成分を見るには，まず傾向を取り除く必要がある．

```{tip} 観測量と状態変数
訪日外客数は月内の外国人旅行者の入国を集計した量であり，ある時刻に日本に滞在している人数ではない．集計対象には永住者等の除外や一時上陸客等の追加があるため，[JNTOの定義](https://statistics.jnto.go.jp/faq/)を確認する．
本講義では月別合計を万人/月の月次水準として扱い，月の中央時刻に配置する．後半の状態変数 $x(t)$ はこの水準の連続時間近似であり，月別集計値と $x(t_i)$ を対応させることは観測上の近似である．
```

## 周期を式で表す

### 正弦関数の振幅，周期，位相

周期的な変動の最も単純な表現は正弦関数である．

$$
s(t) = A \sin\left(\frac{2\pi}{T}\,t + \phi\right)
$$

| 記号 | 意味 | 図での見え方 | 単位 |
| --- | --- | --- | --- |
| $A$ | 振幅 | 山の高さ．平均からの最大のずれ | 状態変数と同じ |
| $T$ | 周期 | 山から次の山までの時間 | 時間 |
| $\phi$ | 位相 | 時刻0での位相角．時間方向の移動量は $-\phi T/(2\pi)$ | 無次元（ラジアン） |

```python
t_demo = np.linspace(0, 3, 301)   # 3年分 [年]
T = 1.0                            # 周期 [年]

fig, axes = plt.subplots(1, 3, figsize=(12, 3.4))
for A_demo in [1.0, 2.0]:
    axes[0].plot(t_demo, A_demo * np.sin(2 * np.pi * t_demo / T), label=f"A = {A_demo}")
axes[0].set_title("Amplitude A (T = 1, phi = 0)")
for T_demo in [1.0, 0.5]:
    axes[1].plot(t_demo, np.sin(2 * np.pi * t_demo / T_demo), label=f"T = {T_demo} year")
axes[1].set_title("Period T (A = 1, phi = 0)")
for phi_demo in [0.0, np.pi / 2]:
    axes[2].plot(t_demo, np.sin(2 * np.pi * t_demo / T + phi_demo), label=f"phi = {phi_demo:.2f}")
axes[2].set_title("Phase phi (A = 1, T = 1)")
for ax in axes:
    ax.set_xlabel("Time [year]")
    ax.set_ylabel("s(t)")
    ax.grid(True)
    ax.legend(loc="upper right")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "sine_parameters.png", dpi=150)
plt.show()
```

位相 $\phi$ は，山がどの時刻に来るかを決める．
$\sin$ の山は引数が $\pi/2$ のときなので，極大の時刻は $t=(\pi/2-\phi+2\pi m)T/(2\pi)$（$m$ は整数）で与えられる．

### 位相を線形化する

最小二乗法で当てはめるとき，$\phi$ が $\sin$ の中に入っていると扱いにくい．
三角関数の加法定理を使うと，

$$
A \sin\left(\frac{2\pi}{T}t + \phi\right)
= \underbrace{A\cos\phi}_{\beta_s}\,\sin\frac{2\pi t}{T}
+ \underbrace{A\sin\phi}_{\beta_c}\,\cos\frac{2\pi t}{T}
$$

と書ける．
$\sin$ と $\cos$ の係数 $\beta_s$，$\beta_c$ を求めれば，振幅と位相は

$$
A = \sqrt{\beta_s^2 + \beta_c^2},
\qquad
\phi = \operatorname{atan2}(\beta_c, \beta_s)
$$

から復元できる．
係数が線形に入るので，通常の最小二乗法が使える．

### 周期モデル：ベースライン，トレンド，周期成分

訪日外客数を，次の3つの成分の和として表す．

$$
g(t) = \underbrace{\beta_0}_{\text{ベースライン}}
+ \underbrace{\beta_1\,(t - t_{\mathrm{ref}})}_{\text{トレンド}}
+ \underbrace{\beta_s \sin\frac{2\pi t}{T} + \beta_c \cos\frac{2\pi t}{T}}_{\text{周期成分}}
$$

| 項 | 意味 | 単位 |
| --- | --- | --- |
| $\beta_0$ | 基準時刻 $t_{\mathrm{ref}}$ における平均的な水準 | 万人/月 |
| $\beta_1$ | 1年あたりの増加量 | 万人/月/年 |
| $\beta_s$，$\beta_c$ | 周期成分の係数．振幅 $A$ と位相 $\phi$ に対応 | 万人/月 |
| $T$ | 周期．年周期なら $T = 1$ 年 | 年 |

この式には微分が含まれていない．
$g(t)$ は時刻を入れれば値が出る関数であり，状態変数の変化率を指定するものではない．
このような表現を，ここでは**回帰的な周期モデル**と呼ぶ．

## 最小二乗法による当てはめ

第7回では`scipy.optimize.least_squares`を使った．
今回のモデルは係数について線形なので，`np.linalg.lstsq`で直接解ける．
説明変数を並べた行列 $X$ と観測値のベクトル $y$ について，$\|X\beta - y\|^2$ を最小にする $\beta$ を求める．

当てはめ期間は2012年1月から2019年12月とし，2020年以降は検証に使う．

```python
T = 1.0             # 周期 [年]
t_ref = 2012.0      # トレンドの基準時刻 [年]


def design_matrix(t, T=1.0, t_ref=2012.0):
    """ベースライン，トレンド，年周期の sin と cos を列に持つ行列を返す．"""
    return np.column_stack([
        np.ones_like(t),
        t - t_ref,
        np.sin(2 * np.pi * t / T),
        np.cos(2 * np.pi * t / T),
    ])


t_fit = fit_data["t"].values
y_fit = fit_data["visitors_10k"].values

X_fit = design_matrix(t_fit, T, t_ref)
beta, residual_sum, rank, singular_values = np.linalg.lstsq(X_fit, y_fit, rcond=None)

beta_0, beta_1, beta_s, beta_c = beta
amplitude = np.hypot(beta_s, beta_c)
phase = np.arctan2(beta_c, beta_s)
peak_time = ((np.pi / 2 - phase) / (2 * np.pi)) * T % T    # 年内で最初の山の時刻 [年]

print(f"ベースライン beta_0 = {beta_0:7.2f} 万人/月（{t_ref:.0f}年時点）")
print(f"トレンド     beta_1 = {beta_1:7.2f} 万人/月/年")
print(f"周期成分     beta_s = {beta_s:7.2f}, beta_c = {beta_c:7.2f} 万人/月")
print(f"振幅 A = {amplitude:.2f} 万人/月，位相 phi = {phase:.3f} rad，最初の山 = 年初から {12 * peak_time:.1f} か月目")
```

トレンドは1年あたり約32万人/月の増加，年周期の振幅は約13万人/月と推定される．
山は4月中旬ごろに来る．

### 観測値，当てはめ，残差の図

当てはめ期間だけでなく，2003年から最新月まで全期間に $g(t)$ を延長して描く．
残差 $y_i - g(t_i)$ を下段に描くと，周期性で説明できない変動が見えてくる．

```python
t_all = visitors["t"].values
y_all = visitors["visitors_10k"].values
g_all = design_matrix(t_all, T, t_ref) @ beta
residual_all = y_all - g_all

fig, (ax_top, ax_bottom) = plt.subplots(2, 1, figsize=(9, 6.5), sharex=True)
ax_top.plot(t_all, y_all, color="black", linewidth=1, marker="o", markersize=2, label="observed")
ax_top.plot(t_all, g_all, color="tab:blue", label="periodic model g(t)")
ax_top.axvspan(2012, 2020, color="lightgray", alpha=0.4, label="fitting period")
ax_top.set_title("Periodic model (baseline + trend + annual cycle) fitted to 2012-2019")
ax_top.set_ylabel("Visitors [10^4 persons/month]")
ax_top.set_ylim(-50, 450)
ax_top.grid(True)
ax_top.legend(loc="upper left")

ax_bottom.plot(t_all, residual_all, color="tab:red", linewidth=1, marker="o", markersize=2)
ax_bottom.axhline(0, color="black", linewidth=0.8)
ax_bottom.axvspan(2012, 2020, color="lightgray", alpha=0.4)
ax_bottom.set_xlabel("Year")
ax_bottom.set_ylabel("Residual [10^4 persons/month]")
ax_bottom.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "visitors_periodic_fit.png", dpi=150)
plt.show()

rmse_fit = np.sqrt(np.mean(residual_all[fit_mask.values] ** 2))
print(f"当てはめ期間の RMSE = {rmse_fit:.1f} 万人/月")
```

当てはめ期間の残差は数十万人/月の範囲に収まる．
一方，2020年2月以降の残差は $-300$ 万人/月を超える．
モデルは2012〜2019年のトレンドと周期を外挿しているため，渡航制限などによる変動を再現しない．ただし，残差には他の要因や外挿誤差も含まれるので，その大きさを感染症や渡航制限の因果効果と同一視してはならない．

````{note} 演習1：周期を追加する

年周期だけでは，4月と7月の2つの山を表せない．
半年周期 $T = 0.5$ 年の $\sin$ と $\cos$ の列を`design_matrix`に追加した関数`design_matrix_two`を作り，同じ期間に当てはめる．

1. 当てはめ期間の RMSE はどれだけ小さくなるか．
2. 月別平均の図と見比べ，2つ目の周期成分が何を表しているかを説明する．
3. RMSE がほとんど下がらないのはなぜか．残差の図で，残差の大きい部分が周期的かどうかを確かめて説明する．
4. 周期成分をさらに増やせば RMSE は少しずつ下がる．それでも成分を増やし続けるべきではない理由を，第4回と第8回の議論を思い出して書く．
````

```{dropdown} 演習1の確認
半年周期を加えても，当てはめ期間の RMSE は約18.0万人/月から約17.9万人/月へとほとんど変わらない．
半年周期の振幅は約2万人/月にとどまる．
月別平均で見えた4月と7月の山は，8年間で約200万人という増加傾向の前では小さく，残差の大部分は周期ではなく，直線で表したトレンドと実際の増え方のずれから来ている．
成分を増やせば当てはめは少しずつ改善するが，各成分の意味は説明しにくくなり，当てはめ期間の外での予測は不安定になる．
訓練期間の適合度と未使用期間の予測精度を区別する必要がある点は，第4回と共通する．
```

## 緩和モデル：目標値との差に比例する変化率

### 仮定と導出

ここまでの $g(t)$ は，時刻を決めれば値が決まる関数だった．
これを微分方程式に組み込むには，状態変数の変化率と目標値 $g(t)$ との関係を定める仮定が必要である．

**仮定**：状態変数 $x$ は，そのときの目標値 $g(t)$ との差に比例する速さで目標に近づく．

$$
\frac{dx}{dt} = -\lambda\,\bigl(x - g(t)\bigr)
$$

| 項 | 意味 | 単位 |
| --- | --- | --- |
| $x$ | 状態変数．ここでは月あたりの訪日外客数の水準 | 万人/月 |
| $g(t)$ | 周期モデルが与える目標値 | 万人/月 |
| $x - g(t)$ | 目標からのずれ | 万人/月 |
| $\lambda$ | 緩和係数．$1/\lambda$ は一定の目標値との差が $1/e$ になる時定数 | 1/年 |

$x > g$ なら右辺は負で $x$ は減り，$x < g$ なら増える．
$g$ が一定なら $x$ は $g$ に指数的に近づき，その時定数は $1/\lambda$ である．
$\lambda>0$，周期入力の角周波数を $\omega=2\pi/T$ とする．過渡成分が減衰した後の周期応答は，入力に対して振幅が $\lambda/\sqrt{\lambda^2+\omega^2}$ 倍，位相が $\arctan(\omega/\lambda)$ ラジアン遅れる．
$\lambda/\omega$ が大きいほど周期応答は入力に近づく．

### 実装

右辺の関数は，時刻 $t$，状態 $x$，パラメタ $\lambda$，そして $g(t)$ の係数を受け取る．
`solve_ivp`は刻み幅を自動で決めるが，右辺が1年周期で変動するので，`max_step`で刻み幅の上限を与えて周期を飛び越えないようにする．

```python
def periodic_target(t, beta, T=1.0, t_ref=2012.0):
    """周期モデル g(t) の値を返す．t はスカラーまたは配列．"""
    t = np.asarray(t, dtype=float)
    return (beta[0] + beta[1] * (t - t_ref)
            + beta[2] * np.sin(2 * np.pi * t / T) + beta[3] * np.cos(2 * np.pi * t / T))


def relaxation_rhs(t, x, lam, beta):
    """dx/dt = -lam * (x - g(t)) の右辺．"""
    return -lam * (x - periodic_target(t, beta))


lam = 4.0                          # 追いつく速さ [1/年]．時定数は 3 か月
t_span = (t_fit[0], t_fit[-1])
x0 = y_fit[0]                      # 2012年1月の観測値を初期値にする

sol = solve_ivp(relaxation_rhs, t_span, [x0], t_eval=t_fit, args=(lam, beta), max_step=1 / 24)
x_relax = sol.y[0]

rmse_relax = np.sqrt(np.mean((x_relax - y_fit) ** 2))
print(f"緩和モデル（lambda = {lam}）の RMSE = {rmse_relax:.1f} 万人/月")
print(f"周期モデル g(t) の RMSE        = {rmse_fit:.1f} 万人/月")
```

```python
fig, ax = plt.subplots(figsize=(9, 4))
ax.plot(t_fit, y_fit, color="black", linewidth=1, marker="o", markersize=2, label="observed")
ax.plot(t_fit, periodic_target(t_fit, beta), color="tab:blue", label="target g(t)")
ax.plot(t_fit, x_relax, color="tab:orange", linestyle="--", label=f"relaxation model, lambda = {lam} /year")
ax.set_title("Relaxation toward a periodic target (2012-2019)")
ax.set_xlabel("Year")
ax.set_ylabel("Visitors [10^4 persons/month]")
ax.grid(True)
ax.legend(loc="upper left")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "visitors_relaxation.png", dpi=150)
plt.show()
```

### 回帰的な周期モデルと緩和モデルの違い

| 観点 | 周期モデル $g(t)$ | 緩和モデル $x' = -\lambda(x - g(t))$ |
| --- | --- | --- |
| 式の種類 | 時刻の関数 | 微分方程式 |
| 表しているもの | 各時刻の値そのもの | 値が目標に近づく仕組み |
| 初期条件 | 不要 | 必要 |
| 追加のパラメタ | なし | $\lambda$ |
| 当てはまり | 指定した説明変数と訓練データに対する残差二乗和を最小化する | 固定した $g(t)$ に対する応答を計算し，RMSEを別に評価する |
| 意味を持つ場面 | 周期性の記述と予測 | 需要が急に変わったときの回復の速さ，慣性のある量 |

最小二乗で推定した $g(t)$ は，採用した回帰モデルの範囲で残差二乗和を最小化する．緩和モデルには初期条件に依存する過渡成分もあるため，当てはまりが必ず悪化するとは限らない．
$\lambda$ が十分大きいと過渡成分の減衰後は $x(t)$ が $g(t)$ に近づく．$\lambda$ は目標値の変化に対する応答の時定数を規定するため，その解釈には急変後の応答も検討する必要がある．
2020年に目標がほぼゼロに落ち，2022年後半から回復した過程は，緩和の速さで議論できる現象の1つである．

逆に，年周期成分の極大が4月ごろに現れるという特徴を説明したいだけなら，微分方程式を持ち出す理由はない．
時間依存の項を持つモデルを作るときは，その項が変化率を規定する過程の仮定なのか，時系列の特徴を記述する関数なのかを区別する．

````{note} 演習2：緩和係数による応答の変化

`lam`を`1.0`，`4.0`，`12.0`，`50.0`に変えて計算し，次を`README.md`に記録する．

1. それぞれの RMSE．
2. 図の上で，緩和モデルの山が目標 $g(t)$ の山からどれだけ遅れているか，振幅がどれだけ小さくなっているか．
3. $\lambda = 1$ /年は時定数1年に対応する．年周期の入力に時定数1年の緩和モデルが応答すると，振幅と位相はどう変わるか，図を根拠に説明する．
````

```{dropdown} 演習2の確認
$\lambda = 1$ では RMSE が約34万人/月と大きく，山が数か月遅れ，振幅も小さくなる．
$\lambda = 4$ で約20万人/月，$\lambda = 12$ 以上ではほぼ $g(t)$ と同じ約18万人/月になる．
時定数 $1/\lambda$ が周期 $T$ と等しい場合，定常周期応答の振幅比は $1/\sqrt{1+4\pi^2}\approx0.157$ となり，入力より大幅に小さくなる．
```

## オープンデータとの比較：残差を読む

周期モデルの残差 $y_i - g(t_i)$ は，トレンドと年周期からなる予測値に対する観測値の差である．
残差の時系列から，モデルに入っていない要因を探す．

```python
residual_series = pd.DataFrame({
    "year": visitors["year"],
    "month": visitors["month"],
    "t": t_all,
    "observed": y_all,
    "model": g_all,
    "residual": residual_all,
})

print("残差が大きい月（当てはめ期間内，絶対値の上位5件）")
inside = residual_series[fit_mask.values]
print(inside.reindex(inside["residual"].abs().sort_values(ascending=False).index).head(5).round(1).to_string(index=False))

print("\n2020年の各月の残差 [万人/月]")
print(residual_series[residual_series["year"] == 2020][["month", "observed", "model", "residual"]].round(1).to_string(index=False))
```

````{note} 演習3：残差の要因を挙げる

1. 当てはめ期間内で残差の絶対値が大きい月について，その月に何があったかを調べて`README.md`に書く．候補は，祝日や連休の並び，天候，自然災害，為替，ビザ制度の変更，大規模な行事などである．
2. 2020年から2022年の残差の推移から，渡航制限の開始と緩和の時期を読み取る．
3. 2023年以降の観測値は，2019年までの傾向を延長した $g(t)$ と比べてどうか．傾向が元に戻ったと言えるか，別のトレンドに乗ったと言えるか．
````

```{tip} 残差から要因を検討する際の注意
残差が大きい期間について，モデルに含めていない要因，パラメタの時間変化，観測方法の変更を検討する．
感染症や災害との時間的な対応は仮説を立てる材料になるが，残差だけでは因果関係を特定できない．
非周期的な変動を表すには，介入時点の指示変数や外部入力など，周期項とは異なる表現を検討する．
```

## 発展：電力需要と複数の周期

電力需要にも，トレンドと複数の周期関数の和による回帰モデルを適用できる．
違いは，年周期に加えて週周期と日周期があることである．

東京電力パワーグリッドの「でんき予報」は，過去の電力使用実績を1時間ごとのCSVで公開している．
このデータは，同社のサイト利用規約により，私的利用を超える転載や複製が禁止されている．
そのため講義サイトには同梱せず，各自が公開元から直接取得する．
取得できない場合に授業を続けられるように，次のコードは取得に失敗したとき，明示的に「生成データ」と表示した上で，周期構造だけを模した人工データに切り替える．

```python
TEPCO_URL = "https://www.tepco.co.jp/forecast/html/images/juyo-2019.csv"

try:
    # 1行目は更新日時，2行目は空行，3行目が列名 DATE, TIME, 実績(万kW)
    raw = pd.read_csv(TEPCO_URL, encoding="shift_jis", skiprows=2)
    raw.columns = ["date", "time", "demand_10MW"]
    raw["datetime"] = pd.to_datetime(raw["date"] + " " + raw["time"], format="%Y/%m/%d %H:%M")
    electricity = raw[["datetime", "demand_10MW"]].copy()
    data_label = "TEPCO 2019 (downloaded)"
    print("東京電力の実績データを取得した．出典：東京電力パワーグリッド「でんき予報」過去の電力使用実績データ")
except Exception as error:
    print("取得に失敗した:", type(error).__name__)
    print("代わりに，周期構造だけを模した生成データを使う．これは実測値ではない．")
    rng = np.random.default_rng(0)
    hours = pd.date_range("2019-01-01", "2019-12-31 23:00", freq="h")
    hour_of_day = hours.hour.values
    day_of_year = hours.dayofyear.values
    weekday = hours.weekday.values
    daily_cycle = 700 * np.sin(2 * np.pi * (hour_of_day - 8) / 24)
    weekly_cycle = np.where(weekday >= 5, -350.0, 0.0)
    annual_cycle = 400 * np.cos(2 * np.pi * (day_of_year - 25) / 365) + 500 * np.exp(-((day_of_year - 220) / 30) ** 2)
    demand = 3300 + daily_cycle + weekly_cycle + annual_cycle + rng.normal(0, 60, len(hours))
    electricity = pd.DataFrame({"datetime": hours, "demand_10MW": demand})
    data_label = "synthetic data (NOT measured)"

electricity["hour"] = electricity["datetime"].dt.hour
electricity["weekday"] = electricity["datetime"].dt.weekday
electricity["month"] = electricity["datetime"].dt.month
print("行数:", len(electricity), " 使用データ:", data_label)
```

```python
fig, axes = plt.subplots(1, 3, figsize=(13, 3.6))

hourly = electricity[electricity["month"] == 8].groupby("hour")["demand_10MW"].mean()
axes[0].plot(hourly.index, hourly.values, marker="o", markersize=3)
axes[0].set_title("Daily cycle (August average)")
axes[0].set_xlabel("Hour of day")

weekly = electricity.groupby("weekday")["demand_10MW"].mean()
axes[1].bar(weekly.index, weekly.values, color="lightgray", edgecolor="black")
axes[1].set_title("Weekly cycle (Mon=0 ... Sun=6)")
axes[1].set_xlabel("Day of week")

monthly = electricity.groupby("month")["demand_10MW"].mean()
axes[2].plot(monthly.index, monthly.values, marker="s", markersize=4)
axes[2].set_title("Annual cycle (monthly average)")
axes[2].set_xlabel("Month")
axes[2].set_xticks(range(1, 13))

for ax in axes:
    ax.set_ylabel("Demand [10 MW]")
    ax.grid(True)
fig.suptitle(f"Electricity demand, TEPCO area: {data_label}")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "electricity_cycles.png", dpi=150)
plt.show()
```

実測データでは，日周期は昼に高く深夜に低い山型，週周期は土日が平日より約1割低く，年周期は冬と夏に山，春と秋に谷を持つ．
観光と同じベースラインと周期成分の和という構造で書けるが，周期が3つあり，しかも夏の山は気温に強く依存する．
周期関数だけでは説明しきれない部分が，気温という外部入力による残差として現れる．

````{dropdown} 発展演習：3つの周期を持つモデル

1. 電力需要について，日周期（$T = 1$ 日），週周期（$T = 7$ 日），年周期（$T = 365$ 日）の $\sin$，$\cos$ を列に持つ行列を作り，`np.linalg.lstsq`で当てはめる．時間軸は1月1日0時からの経過日数とする．
2. 残差を月ごとに平均し，どの季節に残差が大きいかを調べる．気温との関係を推測する．
3. 週周期を正弦関数で表すことの限界を，土日と平日の違いの形から説明する．正弦関数の代わりにどのような表現が考えられるか．

実測データが取得できた場合は，出典として「東京電力パワーグリッド『でんき予報』過去の電力使用実績データ」と取得日を`README.md`に記録する．
````

## モデルの限界と改善の問い

- 周期モデルは年周期成分の係数が年によらず一定であると仮定している．祝日の並び，うるう年，旧正月の時期の違いは年ごとに変わるため，年周期の正弦関数では表せない
- トレンドを直線で表したが，2012年から2019年の訪日外客数の増加は直線より速い．対数を取って当てはめる，あるいは第4回のLogistic型の飽和を入れる，といった選択肢がある
- 緩和モデルの $\lambda$ は，今回は手で与えた．第7回の方法で推定できるが，大きな $\lambda$ では予測曲線の変化が小さくなり，$\lambda$ を精度よく推定できない場合がある．急変後の応答などの追加情報も検討する
- 感染症や災害のような一回限りの要因は，周期モデルの外に置いた．これらを扱うには，第11回の感染症モデルのように，その要因自体をモデル化する必要がある

## まとめ

- 周期的な変動は，振幅，周期，位相を持つ正弦関数で表せる．位相は $\sin$ と $\cos$ の係数に分けると線形に扱える
- ベースライン，トレンド，周期成分の和からなる周期モデルは，`np.linalg.lstsq`で当てはめられる．未使用期間の残差は外挿した予測値と観測値の差であり，特定の要因の効果を直接示すものではない
- 緩和モデル $x' = -\lambda(x - g(t))$ は，目標値との差に比例する変化率を表す．周期応答の振幅と位相差，急変後の応答の時定数を評価できる
- 観光と電力需要は，トレンドと周期関数の和で記述できる．残差を分析して外部要因の候補を検討するが，残差のみで因果関係は特定できない
- 微分方程式は万能ではない．時間依存の項が仕組みを表すのか記述にとどまるのかを区別する

## 課題

````{warning} 課題1：周期モデルの当てはめと残差

1. 訪日外客数について，年周期と半年周期を含む周期モデルを2012〜2019年に当てはめ，2003年から最新月までの観測値，モデル，残差を上下2段の図にして`reports/figures/`に保存する．
2. 推定した係数から，年周期と半年周期それぞれの振幅と，山が来る月を求めて表にする．
3. 当てはめ期間内で残差の絶対値が大きい上位3か月について，考えられる要因を1行ずつ書く．
````

````{warning} 課題2：周期モデルと微分方程式モデルの使い分け

次の3つの問いについて，それぞれ回帰的な周期モデル，緩和モデル，両者以外のモデルのいずれが目的に適するかを選び，理由を含めて合計300字程度で答える．

- 来年4月の訪日外客数を見積もりたい
- 渡航制限が解除されてから，訪日外客数が以前の水準に戻るまでの時間を説明したい
- 2020年2月に訪日外客数が急減した理由を説明したい

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

## 次回への接続

ここまでの基本例では，主に状態変数が1つのモデルを扱った．
第10回では，被食者と捕食者のように，互いに影響し合う2つの状態変数を同時に扱う．
状態変数がベクトルになり，`solve_ivp`に渡す初期値と右辺の戻り値が2成分になる．
時系列だけでなく，2つの状態変数を軸にした相平面という新しい図の見方も学ぶ．

## 自分の言葉で説明する問い

1. 正弦関数の振幅，周期，位相は，訪日外客数の図のどこに対応するか．
2. 周期モデル $g(t)$ と緩和モデル $x' = -\lambda(x - g(t))$ は何が違うか．後者を使う意味がある状況を1つ挙げよ．
3. 2020年の残差が $-300$ 万人/月を超えたことは，モデルの失敗と言えるか．言えるとすればどのような意味で，言えないとすればなぜか．
4. 観光と電力需要が同じ周期関数の和で記述できるとはどういうことか．両者で異なる点も1つ挙げよ．
